#!/usr/bin/env python3
"""Вырез объекта со светлого фона → PNG с прозрачностью (для вставок, гайд 8.3).

    _build/.venv/bin/python _build/cutout.py in.jpg out.png [--keep 0.08] [--blur x,y,w,h ...] [--white 232]

Фон = светлые малонасыщенные пиксели, связанные с краем кадра (белое внутри объекта остаётся).
Остаются связные куски не меньше --keep от самого большого (две резинки, веер купюр),
мелкий мусор (облачка, значки) уходит. --blur размывает области в долях кадра (x,y,w,h от 0 до 1) —
например, чтобы бренд на этикетке не читался. Цвет не трогаем: в ч/б переводит скрипт AE.
"""
import argparse
import sys

import cv2
import numpy as np


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--white", type=int, default=232, help="порог светлоты фона (0–255)")
    ap.add_argument("--keep", type=float, default=0.08, help="минимальный кусок, доля от самого большого")
    ap.add_argument("--blur", nargs="*", default=[], help="области x,y,w,h в долях кадра")
    ap.add_argument("--blank", nargs="*", default=[],
                    help="области x,y,w,h: этикетку заменить гладким телом упаковки (банка без бренда)")
    ap.add_argument("--grabcut", action="store_true", help="уточнить маску GrabCut (белые детали у края объекта)")
    ap.add_argument("--close", type=int, default=0,
                    help="закрыть вмятины в маске ядром N px (белая бандероль/наклейка у края объекта)")
    ap.add_argument("--gradient", action="store_true",
                    help="фон с градиентом (тень от студийного света): порог по строкам от яркости краёв")
    ap.add_argument("--erode", type=int, default=0, help="срезать N px края маски (убрать светлый ореол)")
    ap.add_argument("--poly", nargs="*", default=[],
                    help="добавить в объект многоугольник «x,y;x,y;…» в пикселях исходника (белая бандероль, наклейка)")
    ap.add_argument("--bw", action="store_true", help="сразу перевести в ч/б")
    ap.add_argument("--sticker", action="store_true",
                    help="стикер с белой обводкой и тенью на белом фоне: фон и тень — прозрачные, обводка остаётся")
    ap.add_argument("--sticker-outline", type=int, default=26, help="ширина белой обводки стикера, px (для --sticker)")
    ap.add_argument("--sticker-close", type=int, default=71, help="сглаживание контура стикера, px (для --sticker)")
    ap.add_argument("--pad", type=int, default=24)
    args = ap.parse_args()

    im = cv2.imread(args.src, cv2.IMREAD_UNCHANGED)
    if im is None:
        print(f"не читается: {args.src}", file=sys.stderr)
        return 2
    if im.ndim == 2:
        im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
    src_alpha = None
    if im.shape[2] == 4:  # уже с альфой — кладём на белый; если фон прозрачный — берём готовую маску
        if (im[:, :, 3] < 10).mean() > 0.02:
            src_alpha = im[:, :, 3].copy()
        a = im[:, :, 3:4].astype(np.float32) / 255
        im = (im[:, :, :3].astype(np.float32) * a + 255 * (1 - a)).astype(np.uint8)
    h, w = im.shape[:2]

    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    if src_alpha is not None:
        args.white = 256  # фон не ищем
    if args.gradient:
        edge = np.concatenate([hsv[:, :4, 2], hsv[:, -4:, 2]], axis=1).astype(np.float32)
        bgv = np.median(edge, axis=1)
        bgv = cv2.GaussianBlur(bgv.reshape(-1, 1), (1, 61), 0).ravel()
        light = ((hsv[:, :, 2] >= (bgv[:, None] - (255 - args.white))) & (hsv[:, :, 1] <= 30)).astype(np.uint8)
    else:
        light = ((hsv[:, :, 2] >= args.white) & (hsv[:, :, 1] <= 40)).astype(np.uint8)
    n, lab = cv2.connectedComponents(light, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    if args.sticker:
        # Белая обводка стикера такая же светлая, как фон; разделяет их только мягкая серая тень.
        # 1) фон: светлое, связанное с краем; 2) тень: серое, примыкающее к фону; обводка (≥253) в тень не входит.
        V, Sat = hsv[:, :, 2].astype(int), hsv[:, :, 1].astype(int)
        bgv = int(np.median(np.concatenate([V[:4].ravel(), V[-4:].ravel(), V[:, :4].ravel(), V[:, -4:].ravel()])))
        outer = (V >= bgv - 1) & (Sat < 12)
        n, lab = cv2.connectedComponents(outer.astype(np.uint8), connectivity=4)
        edge_l = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        bg = np.isin(lab, list(edge_l))
        shadow = (V < bgv - 1) & (V > bgv - 60) & (Sat < 25)
        grow = bg.copy()
        for _ in range(200):  # тень растим от фона внутрь, пока она примыкает
            nb = cv2.dilate(grow.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (shadow | outer) & ~grow
            nb &= ~(outer & ~bg)  # светлое не-фоновое (обводка) не захватываем
            if not nb.any():
                break
            grow |= nb
        bg = grow
    obj = (~bg).astype(np.uint8)
    obj = cv2.morphologyEx(obj, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    n, lab, st, _ = cv2.connectedComponentsWithStats(obj, connectivity=8)
    if n <= 1:
        print("объект не найден", file=sys.stderr)
        return 1
    areas = st[1:, cv2.CC_STAT_AREA]
    big = areas.max()
    keep = [i + 1 for i, a in enumerate(areas) if a >= args.keep * big]
    mask = np.isin(lab, keep).astype(np.uint8) * 255
    if args.sticker:
        # где тень слабая, обводку могло «съесть» вместе с фоном: восстанавливаем её как у настоящего стикера —
        # рисунок + отступ на ширину обводки, контур сглажен, дыры заполнены
        V, Sat = hsv[:, :, 2].astype(int), hsv[:, :, 1].astype(int)
        content = ((V < 215) | (Sat > 40)).astype(np.uint8) * 255
        r = args.sticker_outline
        grown = cv2.dilate(content, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
        mask = cv2.bitwise_or(mask, grown)
        k = args.sticker_close
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        ff = mask.copy()
        cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 255)
        mask = cv2.bitwise_or(mask, cv2.bitwise_not(ff))  # заполнить дыры
        n2, lab2, st2, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), connectivity=8)
        mask = (lab2 == 1 + int(np.argmax(st2[1:, cv2.CC_STAT_AREA]))).astype(np.uint8) * 255
        # серую тень за пределами обводки не берём: срезаем всё, что дальше обводки от рисунка
        limit = cv2.dilate(content, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 9, 2 * r + 9)))
        limit = cv2.morphologyEx(limit, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        ff = limit.copy()
        cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 255)
        limit = cv2.bitwise_or(limit, cv2.bitwise_not(ff))
        mask = cv2.bitwise_and(mask, limit)
        mask = cv2.GaussianBlur(mask, (5, 5), 0)
        mask = np.where(mask > 127, 255, 0).astype(np.uint8)
    for spec in args.poly:
        pts = np.array([[float(v) for v in pt.split(",")] for pt in spec.split(";")], np.int32)
        cv2.fillPoly(mask, [pts], 255)
    if args.close:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (args.close, args.close))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)
    if args.grabcut:
        gc = np.where(mask > 0, cv2.GC_PR_FGD, cv2.GC_PR_BGD).astype(np.uint8)
        gc[cv2.erode(mask, np.ones((15, 15), np.uint8)) > 0] = cv2.GC_FGD
        gc[:3, :] = gc[-3:, :] = cv2.GC_BGD
        gc[:, :3] = gc[:, -3:] = cv2.GC_BGD
        bgm, fgm = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(im, gc, None, bgm, fgm, 5, cv2.GC_INIT_WITH_MASK)
        mask = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    def box(spec):
        x, y, bw, bh = [float(v) for v in spec.split(",")]
        return int(x * w), int(y * h), int((x + bw) * w), int((y + bh) * h)

    for spec in args.blank:  # по каждой колонке — плавный переход от цвета над этикеткой к цвету под ней
        x0, y0, x1, y1 = box(spec)
        top = im[max(0, y0 - 6):y0 - 1].astype(np.float32).mean(0)
        bot = im[y1 + 1:min(h, y1 + 6)].astype(np.float32).mean(0)
        u = np.linspace(0, 1, y1 - y0)[:, None, None]
        fillv = (top[None] * (1 - u) + bot[None] * u)[:, x0:x1]
        fillv = cv2.GaussianBlur(fillv, (1, 15), 0)
        region = mask[y0:y1, x0:x1] > 0
        im[y0:y1, x0:x1][region] = fillv[region].astype(np.uint8)

    for spec in args.blur:
        x0, y0, x1, y1 = box(spec)
        k = max(31, (min(x1 - x0, y1 - y0) // 6) | 1)
        region = mask[y0:y1, x0:x1] > 0
        im[y0:y1, x0:x1][region] = cv2.GaussianBlur(im[y0:y1, x0:x1], (k, k), 0)[region]
    if args.erode:
        mask = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * args.erode + 1, 2 * args.erode + 1)))
    if src_alpha is not None:
        mask = src_alpha
    # дыры внутри объекта (белые блики, не связанные с краем) уже в маске; сглаживаем край
    alpha = mask if src_alpha is not None else cv2.GaussianBlur(mask, (3, 3), 0)

    ys, xs = np.where(mask > 0)
    y0, y1 = max(0, ys.min() - args.pad), min(h, ys.max() + args.pad + 1)
    x0, x1 = max(0, xs.min() - args.pad), min(w, xs.max() + args.pad + 1)
    if args.bw:
        im = cv2.cvtColor(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
    out = np.dstack([im, alpha])[y0:y1, x0:x1]
    cv2.imwrite(args.dst, out)
    print(f"{args.dst}: {out.shape[1]}×{out.shape[0]}, кусков: {len(keep)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
