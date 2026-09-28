#!/usr/bin/env python3
"""Подготовка SFX по гайду (12.1, 12.4): обрезка тишины/хвоста, варианты по высоте тона,
пиковая громкость −12 dBFS, WAV 48 кГц стерео.

    _build/.venv/bin/python _build/sfx_prep.py SRC KIND OUT_DIR [--pitch 0,+2,-2] [--max 1.5] [--highpass 0]
                                                               [--speed 1.0] [--peak -12] [--start 1]

Файлы: OUT_DIR/KIND_<n>.wav, нумерация с --start. Скрипт AE берёт их по префиксу KIND_.
--pitch   — полутоны для каждого варианта (гайд: ±2);
--max     — обрезать до N секунд с фейдом в конце (длинный хвост удара);
--highpass— срез низа, Гц (сделать из низкого whoosh светлый swish);
--speed   — ускорить (swish короче whoosh).
"""
import argparse
import subprocess
import sys
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("kind")
    ap.add_argument("out", type=Path)
    ap.add_argument("--pitch", default="0")
    ap.add_argument("--max", type=float, default=0.0)
    ap.add_argument("--highpass", type=float, default=0.0)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--peak", type=float, default=-12.0)
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--tail", type=float, default=0.0, help="взять только последние N секунд (riser из длинного нарастания)")
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    for k, st in enumerate(float(x) for x in args.pitch.split(",")):
        ratio = 2 ** (st / 12) * args.speed
        chain = ["aresample=48000"]  # asetrate ниже считает от 48 кГц — приводим исходник к ним
        if args.tail:
            chain += ["areverse", f"atrim=0:{args.tail}", "areverse", "afade=t=in:d=0.15"]
        chain += ["silenceremove=start_periods=1:start_threshold=-60dB",
                 f"asetrate={int(48000 * ratio)}", "aresample=48000"]
        if args.highpass:
            chain.append(f"highpass=f={args.highpass}")
        if args.max:
            chain += [f"atrim=0:{args.max}", f"afade=t=out:st={max(0.0, args.max - 0.3)}:d=0.3"]
        # хвост тише −60 дБ убираем
        chain += ["areverse", "silenceremove=start_periods=1:start_threshold=-60dB", "areverse"]
        tmp = args.out / f"_{args.kind}_{k}.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", args.src, "-af", ",".join(chain),
                        "-ac", "2", "-ar", "48000", str(tmp)], check=True)
        # пиковая нормализация
        vol = subprocess.run(["ffmpeg", "-i", str(tmp), "-af", "volumedetect", "-f", "null", "-"],
                             capture_output=True, text=True).stderr
        peak = float(vol.split("max_volume:")[1].split("dB")[0])
        dst = args.out / f"{args.kind}_{args.start + k}.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", f"volume={args.peak - peak}dB",
                        "-c:a", "pcm_s16le", str(dst)], check=True)
        tmp.unlink()
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                                    "csv=p=0", str(dst)], capture_output=True, text=True).stdout)
        print(f"{dst.name}: {st:+.0f} пт, {dur:.2f} с, пик {args.peak} dBFS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
