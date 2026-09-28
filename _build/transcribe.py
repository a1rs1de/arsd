#!/usr/bin/env python3
"""Расшифровка исходника с таймкодом каждого слова (гайд, разделы 3.2 и 6.4).

    _build/.venv/bin/python _build/transcribe.py source.mp4 -o transcript.json [--lang en]

На выходе JSON: segments[] с words[] {w, start, end, p}. Время — секунды исходника.
Слова-паразиты («um», «uh», «э-э») Whisper склонен выкидывать — initial_prompt
с ними заставляет модель их писать, чтобы черновой монтаж (3.2) мог их вырезать.
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

FILLER_PROMPT = {
    "en": "Um, uh, so, like, you know, I mean... Uh, yeah. Hmm.",
    "ru": "Э-э, ну, короче, как бы, м-м, это самое... Ну вот. Э-э.",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("media", type=Path)
    ap.add_argument("-o", "--out", type=Path, required=True)
    ap.add_argument("--lang", default=None, help="en / ru / … (по умолчанию определяется)")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--device", default="auto")
    args = ap.parse_args()

    from faster_whisper import WhisperModel

    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "a.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(args.media), "-ac", "1", "-ar", "16000", str(wav)],
                       check=True)
        model = WhisperModel(args.model, device=args.device,
                             compute_type="int8" if args.device in ("auto", "cpu") else "float16")
        segs, info = model.transcribe(
            str(wav), language=args.lang, word_timestamps=True, vad_filter=False, beam_size=5,
            initial_prompt=FILLER_PROMPT.get(args.lang or "en"), condition_on_previous_text=False,
        )
        out = {"media": str(args.media), "language": info.language, "duration": info.duration, "segments": []}
        for s in segs:
            out["segments"].append({
                "start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip(),
                "words": [{"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3),
                           "p": round(w.probability, 3)} for w in (s.words or [])],
            })
            print(f"[{s.start:7.2f}–{s.end:7.2f}] {s.text.strip()}", file=sys.stderr)
    args.out.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
