#!/usr/bin/env python3
"""Проверка лица спикера в вертикальном клипе arsd (гайд: разделы 2, 4.1, 6.2, 15, 16).

Берёт отрендеренное видео (1080×1920 или превью той же пропорции) и композицию
(JSON: холст, строка субтитров, планы) и проверяет две вещи:

1. Субтитры: каждые 0,5 с (и минимум один кадр на каждый план) находит рамку
   лица и проверяет, что её нижний край выше верха строки субтитров
   (y ≈ 1200) с запасом 40 px, т. е. низ рамки ≤ 1160. Нарушения — список
   таймкодов и отрендеренные кадры с разметкой.
2. Кадрирование: на каждом плане глаза на y ≈ 640, подбородок выше y ≈ 1000.
   Если план слишком крупный (от глаз до подбородка больше 360 px, правило
   не выполнить без уменьшения масштаба) — таймкоды плана и нужный масштаб.

Запуск:
    bash _build/setup.sh                      # один раз
    _build/.venv/bin/python _build/check_face.py clip.mp4 --comp clip.comp.json

Код выхода: 0 — всё в порядке, 1 — есть нарушения, 2 — ошибка входных данных.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
from dataclasses import dataclass, field
from pathlib import Path

os.environ.setdefault("GLOG_minloglevel", "2")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import cv2  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
DEFAULT_MODEL = HERE / "models" / "face_landmarker.task"

# Значения по умолчанию = гайд, раздел 16 (face_zone). Композиция может переопределить.
DEFAULTS = {
    "canvas": {"width": 1080, "height": 1920},
    "subtitles": {"top_y": 1200, "bottom_y": 1320},
    "face_zone": {
        "margin_px": 40,
        "eyes_y": 640,
        "eyes_tolerance_px": 40,
        "chin_max_y": 1000,
        "sample_every_s": 0.5,
    },
}

# Индексы точек MediaPipe Face Mesh (478 точек).
LM_IRIS = (468, 473)
LM_EYE_CORNERS = (33, 133, 362, 263)
LM_CHIN = 152

# Цвета разметки (BGR) — палитра гайда.
RED = (29, 22, 200)  # #C8161D
WHITE = (245, 252, 253)  # #FDFCF5
INK = (17, 17, 17)
GREEN = (80, 200, 80)
AMBER = (0, 170, 255)


@dataclass
class Face:
    x0: float
    y0: float
    x1: float
    y1: float
    eyes_y: float
    chin_y: float

    @property
    def area(self) -> float:
        return (self.x1 - self.x0) * (self.y1 - self.y0)


@dataclass
class Sample:
    t: float
    frame: int
    shot: int
    faces: list[Face] = field(default_factory=list)

    @property
    def main(self) -> Face | None:
        return max(self.faces, key=lambda f: f.area) if self.faces else None


@dataclass
class Shot:
    idx: int
    start: float
    end: float
    label: str = ""


def deep_merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in over.items():
        out[k] = deep_merge(base[k], v) if isinstance(v, dict) and isinstance(base.get(k), dict) else v
    return out


def tc(t: float, fps: float) -> str:
    """Таймкод мм:сс:кк (кадры), как в таймлайне Premiere/AE."""
    f = int(round(t * fps))
    fps_i = int(round(fps))
    s, ff = divmod(f, fps_i)
    m, ss = divmod(s, 60)
    return f"{m:02d}:{ss:02d}:{ff:02d}"


def load_composition(path: Path | None) -> dict:
    comp = {}
    if path:
        with open(path, encoding="utf-8") as fh:
            comp = json.load(fh)
    return deep_merge(DEFAULTS, comp)


def make_landmarker(model: Path):
    import mediapipe as mp
    from mediapipe.tasks.python import vision
    from mediapipe.tasks.python.core.base_options import BaseOptions

    if not model.is_file():
        sys.exit(f"Нет модели {model}. Запусти: bash _build/setup.sh")
    opts = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(model)),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=4,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
    )
    # MediaPipe/TFLite пишут служебные строки прямо в stderr — глушим на время загрузки.
    saved = os.dup(2)
    devnull = os.open(os.devnull, os.O_WRONLY)
    os.dup2(devnull, 2)
    try:
        lm = vision.FaceLandmarker.create_from_options(opts)
    finally:
        os.dup2(saved, 2)
        os.close(devnull)
        os.close(saved)

    def detect(bgr: np.ndarray, sx: float, sy: float) -> list[Face]:
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        h, w = bgr.shape[:2]
        faces = []
        for pts in res.face_landmarks:
            xs = [p.x * w * sx for p in pts]
            ys = [p.y * h * sy for p in pts]
            eye_idx = LM_IRIS if len(pts) > max(LM_IRIS) else LM_EYE_CORNERS
            faces.append(
                Face(
                    x0=min(xs), y0=min(ys), x1=max(xs), y1=max(ys),
                    eyes_y=statistics.fmean(ys[i] for i in eye_idx),
                    chin_y=ys[LM_CHIN],
                )
            )
        return faces

    return lm, detect


def detect_cuts(cap: cv2.VideoCapture, fps: float, n_frames: int, min_shot_s: float = 0.4) -> list[float]:
    """Склейки (если планы не заданы в композиции): резкая смена гистограммы
    или картинки — второе ловит склейку между планами одного и того же спикера."""
    cuts, prev, prev_gray, last_cut = [], None, None, 0
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    for i in range(n_frames):
        ok, frame = cap.read()
        if not ok:
            break
        small = cv2.resize(frame, (96, 170))
        hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1], None, [24, 16], [0, 180, 0, 256])
        cv2.normalize(hist, hist)
        gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (5, 5), 0).astype(np.int16)
        if prev is not None:
            corr = cv2.compareHist(prev, hist, cv2.HISTCMP_CORREL)
            diff = float(np.mean(np.abs(gray - prev_gray)))
            if (corr < 0.55 or diff > 22) and (i - last_cut) >= min_shot_s * fps:
                cuts.append(i / fps)
                last_cut = i
        prev, prev_gray = hist, gray
    return cuts


def build_shots(comp: dict, cap, fps: float, n_frames: int, duration: float) -> list[Shot]:
    raw = comp.get("shots")
    if raw:
        return [Shot(i, float(s["start"]), float(s["end"]),
                     " · ".join(str(x) for x in (s.get("id"), s.get("label")) if x)) for i, s in enumerate(raw)]
    bounds = [0.0, *detect_cuts(cap, fps, n_frames), duration]
    return [Shot(i, a, b, "авто") for i, (a, b) in enumerate(zip(bounds, bounds[1:])) if b > a]


def mid_frame(shot: Shot, fps: float) -> int:
    return int((shot.start + shot.end) / 2 * fps)


def sample_times(shots: list[Shot], duration: float, step: float, fps: float) -> list[tuple[float, int]]:
    """Каждые step секунд + минимум один кадр на каждый план (через 3 кадра после склейки и середина)."""
    times = set()
    t = 0.0
    while t < duration:
        times.add(int(round(t * fps)))
        t += step
    for s in shots:
        times.add(int(round(min(s.start + 3 / fps, s.end - 1 / fps) * fps)))
        times.add(mid_frame(s, fps))
    last = int(duration * fps) - 1
    frames = sorted(f for f in times if 0 <= f <= last)
    return [(f / fps, f) for f in frames]


def shot_of(t: float, shots: list[Shot]) -> int:
    for s in shots:
        if s.start <= t < s.end:
            return s.idx
    return shots[-1].idx if shots else 0


def draw_overlay(frame: np.ndarray, sample: Sample, cfg: dict, sx: float, sy: float, fps: float, note: str) -> np.ndarray:
    """Кадр с разметкой в координатах холста (рисуем поверх кадра видео)."""
    img = frame.copy()
    h, w = img.shape[:2]
    fz, sub = cfg["face_zone"], cfg["subtitles"]

    def Y(y):  # холст → пиксели кадра
        return int(round(y / sy))

    def X(x):
        return int(round(x / sx))

    band = img.copy()
    cv2.rectangle(band, (0, Y(sub["top_y"])), (w, Y(sub["bottom_y"])), RED, -1)
    img = cv2.addWeighted(band, 0.35, img, 0.65, 0)
    lim = sub["top_y"] - fz["margin_px"]
    for y, col, label in (
        (lim, RED, f"low face limit {lim}"),
        (sub["top_y"], RED, f"subtitles top {sub['top_y']}"),
        (fz["chin_max_y"], AMBER, f"chin max {fz['chin_max_y']}"),
        (fz["eyes_y"], GREEN, f"eyes {fz['eyes_y']}"),
    ):
        cv2.line(img, (0, Y(y)), (w, Y(y)), col, 2, cv2.LINE_AA)
        cv2.putText(img, label, (10, Y(y) - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.9 / sy, col, 2, cv2.LINE_AA)
    for f in sample.faces:
        bad = f.y1 > lim
        cv2.rectangle(img, (X(f.x0), Y(f.y0)), (X(f.x1), Y(f.y1)), RED if bad else GREEN, 3)
        cv2.line(img, (X(f.x0), Y(f.eyes_y)), (X(f.x1), Y(f.eyes_y)), GREEN, 1)
        cv2.putText(img, f"bottom {f.y1:.0f}", (X(f.x0), Y(f.y1) + int(28 / sy)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8 / sy, RED if bad else GREEN, 2, cv2.LINE_AA)
    txt = f"{tc(sample.t, fps)}  {note}"
    cv2.rectangle(img, (0, 0), (w, int(60 / sy)), INK, -1)
    cv2.putText(img, txt, (14, int(42 / sy)), cv2.FONT_HERSHEY_SIMPLEX, 1.0 / sy, WHITE, 2, cv2.LINE_AA)
    return img


def check_framing(shot: Shot, samples: list[Sample], fz: dict) -> dict | None:
    main = [s.main for s in samples if s.main]
    if not main:
        return None
    eyes = statistics.median(f.eyes_y for f in main)
    chin = max(f.chin_y for f in main)
    span = statistics.median(f.chin_y - f.eyes_y for f in main)
    room = fz["chin_max_y"] - fz["eyes_y"]  # 360 px от глаз до подбородка
    issues = []
    if span > room:
        issues.append(
            f"крупный план: глаза→подбородок {span:.0f} px > {room} px, правило не выполнить; "
            f"нужен масштаб ≈{room / span * 100:.0f} % от текущего или другой план"
        )
    else:
        if abs(eyes - fz["eyes_y"]) > fz["eyes_tolerance_px"]:
            issues.append(f"глаза на y≈{eyes:.0f}, сдвинуть кадр на {fz['eyes_y'] - eyes:+.0f} px")
        if chin > fz["chin_max_y"]:
            issues.append(f"подбородок до y≈{chin:.0f} (> {fz['chin_max_y']})")
    if not issues:
        return None
    return {"eyes_y": round(eyes), "chin_y_max": round(chin), "eyes_to_chin": round(span),
            "too_tight": span > room, "issues": issues}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=Path, help="отрендеренный вертикальный клип (или превью 9:16)")
    ap.add_argument("--comp", type=Path, help="композиция JSON (см. _build/composition.example.json)")
    ap.add_argument("--out", type=Path, help="папка отчёта (по умолчанию _build/out/<имя видео>)")
    ap.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    ap.add_argument("--step", type=float, help="шаг проверки, с (по умолчанию 0.5)")
    args = ap.parse_args()

    if not args.video.is_file():
        print(f"Нет видео: {args.video}", file=sys.stderr)
        return 2
    cfg = load_composition(args.comp)
    fz, sub, canvas = cfg["face_zone"], cfg["subtitles"], cfg["canvas"]
    if args.step:
        fz["sample_every_s"] = args.step
    limit_y = sub["top_y"] - fz["margin_px"]

    cap = cv2.VideoCapture(str(args.video))
    if not cap.isOpened():
        print(f"OpenCV не открыл видео: {args.video}", file=sys.stderr)
        return 2
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    vw, vh = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = n_frames / fps
    sx, sy = canvas["width"] / vw, canvas["height"] / vh  # кадр видео → холст
    if abs(sx - sy) > 0.01:
        print(f"Внимание: видео {vw}×{vh} не 9:16, координаты масштабируются по осям отдельно", file=sys.stderr)

    out = args.out or HERE / "out" / args.video.stem
    (out / "subtitles").mkdir(parents=True, exist_ok=True)
    (out / "framing").mkdir(parents=True, exist_ok=True)
    for old in list((out / "subtitles").glob("*.png")) + list((out / "framing").glob("*.png")):
        old.unlink()

    shots = build_shots(cfg, cap, fps, n_frames, duration)
    plan = sample_times(shots, duration, fz["sample_every_s"], fps)

    lm, detect = make_landmarker(args.model)
    samples: list[Sample] = []
    frames_needed = {f for _, f in plan}
    kept: dict[int, np.ndarray] = {}  # кадры для рендера: нарушения субтитров и середины планов
    mids = {mid_frame(sh, fps) for sh in shots}
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    try:
        by_frame = dict((f, t) for t, f in plan)
        for i in range(max(frames_needed) + 1):
            if i not in frames_needed:
                if not cap.grab():
                    break
                continue
            ok, frame = cap.read()
            if not ok:
                break
            t = by_frame[i]
            s = Sample(t=t, frame=i, shot=shot_of(t, shots), faces=detect(frame, sx, sy))
            samples.append(s)
            if i in mids or (s.faces and max(f.y1 for f in s.faces) > limit_y):
                kept[i] = frame
    finally:
        lm.close()
        cap.release()

    # 1. Субтитры: низ рамки лица ≤ top_y − margin.
    sub_hits = []
    for s in samples:
        worst = max((f.y1 for f in s.faces), default=None)
        if worst is not None and worst > limit_y:
            name = f"{tc(s.t, fps).replace(':', '-')}_f{s.frame}.png"
            note = f"face bottom {worst:.0f} > {limit_y}  (+{worst - limit_y:.0f} px)"
            cv2.imwrite(str(out / "subtitles" / name), draw_overlay(kept[s.frame], s, cfg, sx, sy, fps, note))
            sub_hits.append({"t": round(s.t, 3), "tc": tc(s.t, fps), "frame": s.frame, "shot": s.shot + 1,
                             "face_bottom_y": round(worst), "over_px": round(worst - limit_y),
                             "image": f"subtitles/{name}"})

    # 2. Кадрирование по планам.
    framing = []
    for sh in shots:
        ss = [s for s in samples if s.shot == sh.idx]
        res = check_framing(sh, ss, fz)
        if res is None:
            continue
        mid = min(ss, key=lambda s: abs(s.frame - mid_frame(sh, fps)))
        img = kept.get(mid.frame)
        name = f"shot{sh.idx + 1:02d}_{tc(sh.start, fps).replace(':', '-')}.png"
        if img is not None:
            cv2.imwrite(str(out / "framing" / name),
                        draw_overlay(img, mid, cfg, sx, sy, fps, f"shot {sh.idx + 1}: " + ("TOO TIGHT" if res["too_tight"] else "reframe")))
        framing.append({"shot": sh.idx + 1, "label": sh.label, "start": tc(sh.start, fps), "end": tc(sh.end, fps),
                        **res, "image": f"framing/{name}" if img is not None else None})

    no_face = [tc(s.t, fps) for s in samples if not s.faces]
    report = {
        "video": str(args.video), "fps": fps, "size": [vw, vh], "duration_s": round(duration, 2),
        "rules": {"face_bottom_max_y": limit_y, "subtitles_top_y": sub["top_y"], "margin_px": fz["margin_px"],
                  "eyes_y": fz["eyes_y"], "eyes_tolerance_px": fz["eyes_tolerance_px"], "chin_max_y": fz["chin_max_y"]},
        "shots": [{"shot": s.idx + 1, "start": tc(s.start, fps), "end": tc(s.end, fps), "label": s.label} for s in shots],
        "samples_checked": len(samples),
        "subtitle_zone_hits": sub_hits,
        "framing_issues": framing,
        "no_face": no_face,
    }
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # Вывод в терминал.
    print(f"{args.video.name}: {duration:.1f} с, {fps:.2f} fps, планов: {len(shots)}, проверено кадров: {len(samples)}")
    print(f"\nЛицо в зоне субтитров (низ рамки > {limit_y} = {sub['top_y']} − {fz['margin_px']}): {len(sub_hits)}")
    for h in sub_hits:
        print(f"  {h['tc']}  план {h['shot']}  низ лица y={h['face_bottom_y']}  (+{h['over_px']} px)  → {h['image']}")
    print(f"\nКадрирование (глаза y≈{fz['eyes_y']}±{fz['eyes_tolerance_px']}, подбородок ≤ {fz['chin_max_y']}): "
          f"планов с замечаниями: {len(framing)}")
    for f in framing:
        tag = "КРУПНЫЙ" if f["too_tight"] else "reframe"
        label = f" ({f['label']})" if f["label"] else ""
        print(f"  план {f['shot']}{label} {f['start']}–{f['end']} [{tag}]: " + "; ".join(f["issues"]))
    if no_face:
        print(f"\nЛицо не найдено (вставка/графика?) в {len(no_face)} кадрах: {', '.join(no_face[:12])}"
              + (" …" if len(no_face) > 12 else ""))
    print(f"\nОтчёт: {out / 'report.json'}")
    return 1 if (sub_hits or framing) else 0


if __name__ == "__main__":
    sys.exit(main())
