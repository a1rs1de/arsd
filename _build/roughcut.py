#!/usr/bin/env python3
"""Черновой монтаж + reframe по плану клипа (гайд, разделы 3 и 4).

    _build/.venv/bin/python _build/roughcut.py projects/<проект>/clip.plan.json [--render]

План (clip.plan.json) — какие куски исходника и в каком порядке (хук первым, 3.1).
Скрипт:
  1. Режет внутри кусков паузы длиннее 0,3 с (по громкости), оставляя по 2–3 кадра воздуха (3.2).
  2. Для каждого куска считает кадрирование 16:9 → 9:16 по треку лица: глаза на y≈640,
     подбородок выше 1000 (4.1); низ кадра не заходит на вшитые субтитры исходника.
  3. На каждой склейке чередует 100 % / punch-in 112 % (маскировка jump-cut, 4.2),
     внутри куска медленный наезд 100→103 %.
  4. Пересчитывает время слов в таймлайн клипа (для субтитров, раздел 6).
  5. --render: превью 1080×1920 (ffmpeg) без графики — проверить нарезку и кадр.

Выход: <проект>/work/edit.json и <проект>/renders/rough_preview.mp4.
"""
import argparse
import json
import statistics
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

W, H = 1080, 1920


def load_db(wav: Path) -> np.ndarray:
    with wave.open(str(wav)) as w:
        sr = w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    hop = sr // 100
    n = len(a) // hop
    rms = np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(1))
    return 20 * np.log10(rms + 1e-9)


def split_pauses(a: float, b: float, db: np.ndarray, thr_db: float, max_pause: float, air: float):
    """Кусок [a,b] → подкуски без пауз длиннее max_pause (воздух air с каждой стороны)."""
    i0, i1 = int(a * 100), int(b * 100)
    quiet = db[i0:i1] < thr_db
    parts, start, j = [], a, 0
    while j < len(quiet):
        if quiet[j]:
            k = j
            while k < len(quiet) and quiet[k]:
                k += 1
            ps, pe = a + j / 100, a + k / 100
            if pe - ps > max_pause and ps > a + 0.05 and pe < b - 0.05:
                parts.append((start, ps + air))
                start = pe - air
            j = k
        else:
            j += 1
    parts.append((start, b))
    return [(round(x, 3), round(y, 3)) for x, y in parts if y - x > 0.12]


def _n(t: str) -> str:
    return "".join(ch for ch in t.lower().replace("’", "'") if ch.isalnum() or ch == "'")


def seg_words(seg: dict, words: list[dict]) -> list[dict]:
    """Слова сегмента: текст из плана, время — из выравнивания (difflib), без выравнивания — интерполяция."""
    import difflib

    a, b = seg["in"], seg["out"]
    toks = seg.get("text", "").replace("-", " ").replace(",", ", ").split()
    cand = [w for w in words if a - 1.5 <= w["start"] <= b + 1.5]
    if not toks:
        return [w for w in cand if a <= (w["start"] + w["end"]) / 2 < b]
    # слова выравнивания тоже разбиваем по дефису так же, как текст
    flat = []
    for w in cand:
        parts = w["w"].replace("-", " ").split() or [w["w"]]
        d = (w["end"] - w["start"]) / len(parts)
        for k, pt in enumerate(parts):
            flat.append({"n": _n(pt), "start": w["start"] + k * d, "end": w["start"] + (k + 1) * d,
                         "approx": w.get("approx", False)})
    sm = difflib.SequenceMatcher(a=[_n(t) for t in toks], b=[f["n"] for f in flat], autojunk=False)
    times = [None] * len(toks)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            f = flat[blk.b + k]
            times[blk.a + k] = (f["start"], f["end"], f["approx"])
    out = []
    for i, t in enumerate(toks):
        if times[i] is None:
            prev_e = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), a)
            nxt = next(((j, times[j][0]) for j in range(i + 1, len(toks)) if times[j]), (len(toks), b))
            step = max(0.05, (nxt[1] - prev_e) / (nxt[0] - i + 1))
            times[i] = (prev_e, prev_e + step, True)
        s_, e_, ap = times[i]
        s_, e_ = min(max(s_, a), b - 0.05), min(max(e_, a + 0.05), b)
        if out and s_ < out[-1]["end"]:
            s_ = out[-1]["end"]
            e_ = max(e_, s_ + 0.05)
        out.append({"w": t, "start": s_, "end": min(e_, b), **({"approx": True} if ap else {})})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("plan", type=Path)
    ap.add_argument("--render", action="store_true")
    args = ap.parse_args()

    proj = args.plan.parent
    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    src = proj / plan["source"]
    fr = plan["framing"]
    cut = plan.get("rough_cut", {})
    fps_src = plan["source_fps"]
    fps = plan.get("fps", fps_src)

    wav = proj / "work" / "audio16k.wav"
    if not wav.exists():
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "16000", str(wav)], check=True)
    db = load_db(wav)
    track = [r for r in json.loads((proj / plan["face_track"]).read_text()) if "eyes" in r]
    words = json.loads((proj / plan["words"]).read_text(encoding="utf-8"))["words"]

    # 1. Куски без длинных пауз.
    pieces = []
    for si, seg in enumerate(plan["segments"]):
        for a, b in split_pauses(seg["in"], seg["out"], db, cut.get("silence_db", -40),
                                 cut.get("max_pause_s", 0.3), cut.get("air_s", 0.1)):
            pieces.append({"segment": si, "role": seg.get("role", ""), "src_in": a, "src_out": b})

    # 2–3. Кадрирование и punch-in.
    eyes_t, burned_top = fr["eyes_y"], fr["burned_subs_top_src"]
    t_out, punch = 0.0, False
    for p in pieces:
        pts = [r for r in track if p["src_in"] - 0.5 <= r["t"] <= p["src_out"] + 0.5] or track
        eyes = statistics.median(r["eyes"] for r in pts)
        chin = max(r["chin"] for r in pts)
        cx = statistics.median(r["cx"] for r in pts)
        scale = fr["punch_in"] if punch else 1.0
        ch = fr["base_crop_h"] / scale
        ch_end = ch / fr["push_in"]
        # Низ кадра выше вшитых субтитров исходника: bottom = eyes + ch*(1 - eyes_t/H).
        max_ch = (burned_top - eyes) / (1 - eyes_t / H)
        if ch > max_ch:
            ch = max_ch
            ch_end = min(ch_end, ch)
        def rect(h):
            y0 = eyes - h * eyes_t / H
            w = h * W / H
            return [round(cx - w / 2, 2), round(y0, 2), round(w, 2), round(h, 2)]
        k = H / ch_end  # худший случай (конец наезда) для проверки подбородка
        p.update({
            "t_in": round(t_out, 3), "t_out": round(t_out + p["src_out"] - p["src_in"], 3),
            "punch": punch, "crop_start": rect(ch), "crop_end": rect(ch_end),
            "face": {"eyes_src": round(eyes, 1), "chin_src": round(chin, 1),
                     "chin_canvas_max": round(eyes_t + (chin - eyes) * k)},
        })
        t_out = p["t_out"]
        punch = not punch if p["src_out"] - p["src_in"] >= 1.0 else punch

    # 4. Слова → таймлайн клипа. Текст — из плана (вычитанный), время — из выравнивания.
    out_words = []
    for si, seg in enumerate(plan["segments"]):
        for w in seg_words(seg, words):
            mid = (w["start"] + w["end"]) / 2
            p = next((q for q in pieces if q["segment"] == si and q["src_in"] <= mid < q["src_out"]), None)
            if p is None:  # слово попало в вырезанную паузу — прижимаем к ближайшему куску
                p = min((q for q in pieces if q["segment"] == si),
                        key=lambda q: min(abs(mid - q["src_in"]), abs(mid - q["src_out"])))
            off = p["t_in"] - p["src_in"]
            out_words.append({"w": w["w"], "start": round(min(max(p["t_in"], w["start"] + off), p["t_out"] - 0.05), 3),
                              "end": round(min(p["t_out"], max(w["end"] + off, p["t_in"] + 0.05)), 3),
                              "segment": si, **({"approx": True} if w.get("approx") else {})})

    edit = {"source": plan["source"], "fps": fps, "canvas": [W, H], "duration": round(t_out, 3),
            "pieces": pieces, "words": out_words}
    (proj / "work" / "edit.json").write_text(json.dumps(edit, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"кусков: {len(pieces)}, длительность: {t_out:.2f} с, слов: {len(out_words)}")
    for p in pieces:
        print(f"  {p['t_in']:6.2f}–{p['t_out']:6.2f}  src {p['src_in']:6.2f}–{p['src_out']:6.2f}  "
              f"{'punch' if p['punch'] else '100% '}  подбородок y≈{p['face']['chin_canvas_max']}  {p['role']}")
    print(" ".join(w["w"] for w in out_words))

    if args.render:
        render(proj, src, edit, fps)
    return 0


def render(proj: Path, src: Path, edit: dict, fps: float) -> None:
    import cv2

    out_dir = proj / "renders"
    out_dir.mkdir(exist_ok=True)
    tmp_v = out_dir / "_video.mp4"
    cap = cv2.VideoCapture(str(src))
    fps_src = cap.get(cv2.CAP_PROP_FPS)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
                            "-s", f"{W}x{H}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-crf", "18",
                            "-preset", "medium", "-pix_fmt", "yuv420p", str(tmp_v)], stdin=subprocess.PIPE)
    n_out = int(round(edit["duration"] * fps))
    cur_idx, cur_frame = -1, None
    for fi in range(n_out):
        t = fi / fps
        p = next((q for q in edit["pieces"] if q["t_in"] <= t < q["t_out"]), edit["pieces"][-1])
        u = (t - p["t_in"]) / max(1e-6, p["t_out"] - p["t_in"])
        u = u * u * (3 - 2 * u)  # плавно
        x, y, w, h = [a + (b - a) * u for a, b in zip(p["crop_start"], p["crop_end"])]
        src_idx = int((p["src_in"] + (t - p["t_in"])) * fps_src + 1e-6)
        if src_idx != cur_idx:
            if src_idx != cur_idx + 1:
                cap.set(cv2.CAP_PROP_POS_FRAMES, src_idx)
            ok, cur_frame = cap.read()
            cur_idx = src_idx
        m = np.float32([[W / w, 0, -x * W / w], [0, H / h, -y * H / h]])
        enc.stdin.write(cv2.warpAffine(cur_frame, m, (W, H), flags=cv2.INTER_LANCZOS4,
                                       borderMode=cv2.BORDER_REPLICATE).tobytes())
    enc.stdin.close()
    enc.wait()

    # Звук: куски с фейдом 2 кадра на стыках (≈ кроссфейд Constant Power из 3.2).
    fade = 2 / fps
    parts, labels = [], []
    for i, p in enumerate(edit["pieces"]):
        d = p["src_out"] - p["src_in"]
        parts.append(f"[0:a]atrim={p['src_in']}:{p['src_out']},asetpts=PTS-STARTPTS,"
                     f"afade=t=in:d={fade:.3f},afade=t=out:st={d - fade:.3f}:d={fade:.3f}[a{i}]")
        labels.append(f"[a{i}]")
    fc = ";".join(parts) + f";{''.join(labels)}concat=n={len(labels)}:v=0:a=1[a]"
    out = out_dir / "rough_preview.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-i", str(tmp_v), "-filter_complex", fc,
                    "-map", "1:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000",
                    "-shortest", str(out)], check=True)
    tmp_v.unlink()
    print(f"превью: {out}")


if __name__ == "__main__":
    sys.exit(main())
