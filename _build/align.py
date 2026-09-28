#!/usr/bin/env python3
"""Выравнивание готового текста по звуку: время каждого слова (гайд, 3.2 и 6.4).

Нужен, когда текст уже есть (вычитанный SRT или вшитые субтитры, снятые OCR),
а Whisper недоступен или ошибается. Работает на pocketsphinx (модель en-us
лежит внутри pip-пакета, сеть не нужна). Только английская речь.

    _build/.venv/bin/python _build/align.py source.mp4 phrases.json -o words.json

phrases.json: [{"start": 0.0, "end": 1.08, "text": "When we were selling booty bands"}, …]
words.json:   {"words": [{"w", "start", "end", "phrase"}], "gaps": [{"start", "end"}]}
Слова, которых нет в словаре, получают время по пропорции внутри фразы ("approx": true).
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

SR = 16000
FRAME = 0.01  # pocketsphinx: 100 кадров/с
NUM = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven",
       "8": "eight", "9": "nine", "10": "ten", "20s": "twenties", "30s": "thirties", "40s": "forties"}


def norm(token: str) -> str:
    t = token.lower().strip(".,!?;:\"“”()[]")
    t = t.replace("’", "'")
    t = t.replace("*", "")  # f*ck → fck (всё равно OOV → approx)
    return NUM.get(t, t)


def load_audio(media: Path) -> bytes:
    return subprocess.run(["ffmpeg", "-v", "error", "-i", str(media), "-ac", "1", "-ar", str(SR),
                           "-f", "s16le", "-"], check=True, capture_output=True).stdout


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("media", type=Path)
    ap.add_argument("phrases", type=Path)
    ap.add_argument("-o", "--out", type=Path, required=True)
    ap.add_argument("--pad", type=float, default=0.3, help="запас окна вокруг фразы, с")
    args = ap.parse_args()

    from pocketsphinx import Decoder

    pcm = load_audio(args.media)
    dur = len(pcm) / 2 / SR
    phrases = [p for p in json.loads(args.phrases.read_text(encoding="utf-8")) if p.get("text", "").strip()]
    dec = Decoder(samprate=SR, loglevel="FATAL")  # для словаря (lookup_word)

    def known_of(text):
        return [t for t in (norm(x) for x in text.replace("-", " ").split()) if t and dec.lookup_word(t)]

    def try_align(known, start, end):
        """[(word, s, e)], [gaps] или None."""
        for pad in (args.pad, args.pad * 2, args.pad * 4, 2.0):
            a, b = max(0.0, start - pad), min(dur, end + pad)
            chunk = pcm[int(a * SR) * 2:int(b * SR) * 2]
            adec = Decoder(samprate=SR, loglevel="FATAL")  # свежий: после сбоя состояние не переносится
            try:
                adec.set_align_text(" ".join(known))
                adec.start_utt(); adec.process_raw(chunk, full_utt=True); adec.end_utt()
                adec.set_alignment()
                adec.start_utt(); adec.process_raw(chunk, full_utt=True); adec.end_utt()
                segs = list(adec.get_alignment())
            except Exception:  # noqa: BLE001
                continue
            al, gp = [], []
            for seg in segs:
                s_, e_ = a + seg.start * FRAME, a + (seg.start + seg.duration) * FRAME
                if seg.name in ("<sil>", "<s>", "</s>", "[NOISE]"):
                    if e_ - s_ >= 0.15:
                        gp.append({"start": round(s_, 3), "end": round(e_, 3)})
                else:
                    al.append((seg.name, s_, e_))
            return al, gp
        return None

    words, gaps = [], []
    for pi, ph in enumerate(phrases):
        raw = ph["text"].replace("-", " ").split()
        toks = [norm(t) for t in raw]
        known = [t for t in toks if t and dec.lookup_word(t)]
        aligned = []
        if known:
            res = try_align(known, ph["start"], ph["end"])
            if res is None:
                # Граница фразы в субтитрах сильно не совпадает с речью — выравниваем вместе с соседями
                # и берём слова этой фразы по позиции.
                lo, hi = max(0, pi - 1), min(len(phrases), pi + 2)
                before = sum(len(known_of(phrases[j]["text"])) for j in range(lo, pi))
                block = [t for j in range(lo, hi) for t in known_of(phrases[j]["text"])]
                res2 = try_align(block, phrases[lo]["start"], phrases[hi - 1]["end"])
                if res2 is not None and len(res2[0]) == len(block):
                    res = (res2[0][before:before + len(known)], [])
            if res is None:
                print(f"фраза {pi}: выравнивание не удалось, беру пропорцию", file=sys.stderr)
            else:
                aligned, gp = res
                gaps.extend(gp)
        # Раскладываем исходные токены: известные — по выравниванию, остальные — между соседями.
        it = iter(aligned)
        placed = []
        for orig, t in zip(raw, toks):
            if aligned and t and dec.lookup_word(t):
                name, s, e = next(it, (t, None, None))
                placed.append({"w": orig, "start": s, "end": e})
            else:
                placed.append({"w": orig, "start": None, "end": None, "approx": True})
        # Интерполяция для OOV и для фраз без выравнивания.
        n = len(placed)
        for i, w in enumerate(placed):
            if w["start"] is None:
                prev_e = next((placed[j]["end"] for j in range(i - 1, -1, -1) if placed[j]["end"] is not None), ph["start"])
                nxt = next(((j, placed[j]["start"]) for j in range(i + 1, n) if placed[j]["start"] is not None), (n, ph["end"]))
                k = nxt[0] - i + 1
                step = max(0.05, (nxt[1] - prev_e) / k)
                w["start"], w["end"] = prev_e, prev_e + step
        # Вырожденное выравнивание: много слов по 30–50 мс подряд = модель «сжала» фразу,
        # не найдя её в звуке. Тогда раскладываем слова по фразе пропорционально длине слова.
        short = sum(1 for w in placed if w["end"] - w["start"] <= 0.05)
        if n >= 3 and short / n >= 0.4:
            a0, b0 = ph["start"], ph["end"]
            weights = [max(2, len(w["w"])) + 1 for w in placed]
            tot, acc = sum(weights), 0.0
            for w, wt in zip(placed, weights):
                w["start"] = a0 + (b0 - a0) * acc / tot
                acc += wt
                w["end"] = a0 + (b0 - a0) * acc / tot
                w["approx"] = True
            print(f"фраза {pi}: выравнивание вырожденное, время слов по пропорции", file=sys.stderr)
        for w in placed:
            w["start"], w["end"], w["phrase"] = round(w["start"], 3), round(w["end"], 3), pi
            words.append(w)

    # Окна фраз перекрываются запасом — делаем время слов монотонным.
    for prev, w in zip(words, words[1:]):
        if w["start"] < prev["end"]:
            mid = round((w["start"] + prev["end"]) / 2, 3) if w["start"] > prev["start"] else prev["end"]
            prev["end"] = min(prev["end"], mid) if mid > prev["start"] else prev["end"]
            w["start"] = max(mid, prev["end"])
            w["end"] = max(w["end"], w["start"] + 0.04)

    # Вырожденные фразы после склейки окон (слова по 40 мс подряд) — раскладываем по пропорции
    # в промежутке между соседними фразами.
    for pi, ph in enumerate(phrases):
        idx = [i for i, w in enumerate(words) if w["phrase"] == pi]
        if len(idx) < 3:
            continue
        if sum(1 for i in idx if words[i]["end"] - words[i]["start"] <= 0.05) / len(idx) < 0.4:
            continue
        a0 = max(ph["start"], words[idx[0] - 1]["end"] if idx[0] > 0 else 0.0)
        b0 = words[idx[-1] + 1]["start"] if idx[-1] + 1 < len(words) else ph["end"]
        b0 = max(b0, a0 + 0.1 * len(idx))
        weights = [max(2, len(words[i]["w"])) + 1 for i in idx]
        tot, acc = sum(weights), 0.0
        for i, wt in zip(idx, weights):
            words[i]["start"] = round(a0 + (b0 - a0) * acc / tot, 3)
            acc += wt
            words[i]["end"] = round(a0 + (b0 - a0) * acc / tot, 3)
            words[i]["approx"] = True
        print(f"фраза {pi}: слова сжаты выравниванием — время по пропорции {a0:.2f}–{b0:.2f}", file=sys.stderr)

    out = {"media": str(args.media), "engine": "pocketsphinx-align", "words": words, "gaps": gaps}
    args.out.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    approx = sum(1 for w in words if w.get("approx"))
    print(f"слов: {len(words)}, приблизительных: {approx}, пауз ≥0,15 с: {len(gaps)} → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
