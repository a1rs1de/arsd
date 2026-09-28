#!/usr/bin/env python3
"""Данные клипа для After Effects: edit.json + inserts.json → ae/clip_data.jsxinc.

    _build/.venv/bin/python _build/ae_export.py projects/<проект>

Дальше в AE: File → Scripts → Run Script File… → _build/ae/arsd_build.jsx → выбрать
projects/<проект>/ae/clip_data.jsxinc. Скрипт соберёт проект целиком.

Что считается здесь (гайд):
- куски спикера → трансформ AE: anchor = (центр лица, глаза) исходника, position = (540, 640),
  scale по кадрированию из roughcut.py (4.1);
- субтитры (6): группы по 2–4 слова, ≤ 22 знаков, без пунктуации, слово появляется
  за 1,5 кадра до звука, предлог не отрывается от следующего слова;
- акцентные слова (6.3) — не чаще раза в 3 с и не во время вставок и заголовка;
- вставки (9) и SFX (12.4) — время по словам, не больше 2 SFX в секунду.
"""
import json
import re
import sys
from pathlib import Path

W, H = 1080, 1920
DANGLING = {"a", "an", "the", "to", "of", "in", "at", "for", "and", "or", "that", "as", "i", "my", "your",
            "our", "on", "with", "from", "is", "be", "can", "could", "would", "so", "if", "than", "we", "you"}
MAX_WORDS, MAX_CHARS = 4, 22


def clean(w: str) -> str:
    """Без пунктуации на экране (6.1): дефис в слове и знаки чисел остаются."""
    w = w.replace("’", "'")
    w = re.sub(r"^[\"“”'(\[]+|[\"“”')\].,!?;:…]+$", "", w)
    return w


def ends_phrase(w: str) -> bool:
    return bool(re.search(r"[.,!?;:…]$", w.strip("\"”')")))


def norm(w: str) -> str:
    return clean(w).lower()


def find_word(words, at: str, n: int = 1, after: float = -1.0) -> int:
    """Индекс n-го вхождения слова (сравнение без пунктуации)."""
    target, k = norm(at), 0
    for i, w in enumerate(words):
        if w["start"] >= after and norm(w["w"]) == target:
            k += 1
            if k == n:
                return i
    raise SystemExit(f"Слово «{at}» (вхождение {n}) не найдено в edit.json")


def group_subtitles(words, fps: float, duration: float):
    lead = 1.5 / fps
    groups, cur = [], []

    def flush():
        if cur:
            groups.append(list(cur))
            cur.clear()

    for i, w in enumerate(words):
        txt = clean(w["w"])
        if not txt:
            continue
        if cur and cur[-1].get("segment") != w.get("segment"):  # склейка — новая строка
            flush()
        chars = len(" ".join(clean(x["w"]) for x in cur + [w]))
        if cur and (len(cur) >= MAX_WORDS or chars > MAX_CHARS):
            # не оставляем служебное слово висеть в конце строки
            if len(cur) >= 2 and norm(cur[-1]["w"]) in DANGLING and not ends_phrase(cur[-1]["w"]):
                carry = cur.pop()
                flush()
                cur.append(carry)
            else:
                flush()
        cur.append(w)
        if ends_phrase(w["w"]):
            flush()
    flush()
    # одиночное слово в конце фразы — приклеиваем к предыдущей группе, если влезает
    merged = []
    for g in groups:
        if merged and len(g) == 1 and merged[-1][-1].get("segment") == g[0].get("segment") and len(merged[-1]) < MAX_WORDS and \
                len(" ".join(clean(x["w"]) for x in merged[-1] + g)) <= MAX_CHARS and \
                g[0]["start"] - merged[-1][-1]["end"] < 0.4:
            merged[-1].extend(g)
        else:
            merged.append(g)

    # одиночное слово после длинной строки — забираем к нему хвост предыдущей («look at / the Greens category»)
    for gi in range(1, len(merged)):
        g, prev = merged[gi], merged[gi - 1]
        if len(g) == 1 and len(prev) >= 3 and prev[-1].get("segment") == g[0].get("segment"):
            moved = []
            while len(prev) > 2 and len(moved) < 2:
                moved.insert(0, prev.pop())
                if norm(prev[-1]["w"]) not in DANGLING:
                    break
            if len(" ".join(clean(x["w"]) for x in moved + g)) <= MAX_CHARS and norm(prev[-1]["w"]) not in DANGLING:
                merged[gi] = moved + g
            else:
                prev.extend(moved)

    out, prev_in = [], -1.0
    for gi, g in enumerate(merged):
        t_in = max(0.0, g[0]["start"] - lead, prev_in + 0.25)  # время слов местами приблизительное
        prev_in = t_in
        for x in g:
            x["start"] = max(x["start"], t_in + lead)
        if gi + 1 < len(merged):
            nxt = max(0.0, merged[gi + 1][0]["start"] - lead, t_in + 0.25)
            t_out = nxt if nxt - g[-1]["end"] < 0.8 else g[-1]["end"] + 0.3
        else:
            t_out = min(duration, g[-1]["end"] + 0.5)
        out.append({"t_in": round(t_in, 3), "t_out": round(max(t_out, t_in + 0.3), 3),
                    "words": [{"w": clean(x["w"]), "t": round(max(t_in, x["start"] - lead), 3), "i": x["_i"]} for x in g]})
    return out


def main() -> int:
    proj = Path(sys.argv[1]).resolve()
    edit = json.loads((proj / "work" / "edit.json").read_text(encoding="utf-8"))
    spec = json.loads((proj / "inserts.json").read_text(encoding="utf-8"))
    plan = json.loads((proj / "clip.plan.json").read_text(encoding="utf-8"))
    fps, dur = edit["fps"], edit["duration"]
    eyes_t = plan["framing"]["eyes_y"]
    words = edit["words"]
    for i, w in enumerate(words):
        w["_i"] = i

    # Спикер.
    pieces = []
    for p in edit["pieces"]:
        x, y, w, h = p["crop_start"]
        _, _, _, h2 = p["crop_end"]
        pieces.append({"t_in": p["t_in"], "t_out": p["t_out"], "src_in": p["src_in"], "src_out": p["src_out"],
                       "anchor": [round(x + w / 2, 2), round(y + h * eyes_t / H, 2)], "position": [W / 2, eyes_t],
                       "scale_in": round(H / h * 100, 3), "scale_out": round(H / h2 * 100, 3)})

    # Вставки.
    inserts, sfx = [], []
    for ins in spec["inserts"]:
        i0 = find_word(words, ins["at"], ins.get("n", 1))
        t_in = max(0.0, words[i0]["start"] + ins.get("lead", 0.0))
        t_out = min(dur, t_in + ins["dur"])
        d = {k: v for k, v in ins.items() if k not in ("at", "n", "lead", "dur")}
        d.update({"t_in": round(t_in, 3), "t_out": round(t_out, 3)})
        if "items" in ins:
            d["items"] = [{"text": it["text"], "t": round(words[find_word(words, it["at"], it.get("n", 1), t_in - 1)]["start"] - 2 / fps, 3)}
                          for it in ins["items"]]
            sfx += [{"t": it["t"], "kind": "tick", "prio": 2} for it in d["items"]]
        if "count_from_word" in ins:
            a = words[find_word(words, ins["count_from_word"], 1, t_in - 0.5)]["start"]
            b = words[find_word(words, ins["count_to_word"], 1, t_in - 0.5)]["end"]
            d["count_t"] = [round(a, 3), round(max(b, a + 0.5), 3)]
            sfx += [{"t": a, "kind": "tick", "prio": 2}, {"t": d["count_t"][1], "kind": "hit", "prio": 1}]
        if ins["template"] == "V9_compare" and "at" in ins.get("right", {}):
            tr = words[find_word(words, ins["right"]["at"], 1, t_in - 0.5)]["start"] - 2 / fps
            d["right"] = {**ins["right"], "t": round(max(t_in + 0.4, tr), 3)}
            sfx.append({"t": d["right"]["t"], "kind": "swish", "prio": 2})
        if ins["template"] in ("V1_number", "V2_thesis", "V5_object", "V8_chart"):
            sfx.append({"t": t_in + 0.3, "kind": "hit" if ins["template"] == "V1_number" else "pop", "prio": 2})
        sfx += [{"t": t_in, "kind": "swish", "prio": 1}, {"t": t_out - 0.12, "kind": "whoosh", "prio": 1}]
        inserts.append(d)

    busy = [(x["t_in"] - 0.2, x["t_out"] + 0.2) for x in inserts]
    hl = spec.get("headline")
    if hl:
        busy.append((hl["from"], hl["to"] + 0.3))
        sfx.append({"t": hl["from"], "kind": "hit", "prio": 1})

    # Субтитры и акценты.
    subs = group_subtitles(words, fps, dur)
    accents, last = set(), -99.0
    for a in spec.get("accents", []):
        i = find_word(words, a["at"], a.get("n", 1))
        t = words[i]["start"]
        if any(s <= t <= e for s, e in busy):
            print(f"акцент «{a['at']}» ({t:.2f} с) попадает на вставку/заголовок — пропущен", file=sys.stderr)
            continue
        if t - last < 3.0:
            print(f"акцент «{a['at']}» ({t:.2f} с) ближе 3 с к предыдущему — пропущен", file=sys.stderr)
            continue
        accents.add(i)
        last = t
        sfx.append({"t": t - 1 / fps, "kind": "pop", "prio": 3})
    for g in subs:
        for w in g["words"]:
            if w.pop("i") in accents:
                w["accent"] = True

    # SFX: ≤ 2 в секунду (12.4), приоритет 1 важнее.
    sfx.sort(key=lambda s: (s["prio"], s["t"]))
    kept = []
    for s in sfx:
        if sum(1 for k in kept if abs(k["t"] - s["t"]) < 1.0) < 2 and all(abs(k["t"] - s["t"]) > 0.15 for k in kept):
            kept.append(s)
    kept = sorted(({"t": round(max(0.0, s["t"]), 3), "kind": s["kind"]} for s in kept), key=lambda s: s["t"])

    data = {
        "name": proj.name, "fps": fps, "width": W, "height": H, "duration": dur,
        "source": plan["source"], "pieces": pieces, "subtitles": subs, "headline": hl,
        "inserts": inserts, "sfx": kept, "music": spec.get("music", "assets/music"),
        "style": {
            "paper": [253, 252, 245], "white": [255, 255, 255], "ink": [17, 17, 17], "grey_line": [189, 189, 189],
            "grey_text": [107, 107, 107], "accent": [253, 252, 245],
            "sub_y": 1250, "sub_size": 68, "accent_scale": 1.12, "headline_size": 130,
            "fonts": {
                "display": ["Coolvetica", "Regular"], "display_italic": ["Coolvetica", "Italic"],
                "sub": ["Montserrat", "Bold"], "light": ["Montserrat", "Light"], "medium": ["Montserrat", "Medium"],
                "accent": ["Playfair Display", "Italic"],
            },
            # Длительности анимаций гайда (7) — в секундах (в гайде кадры при 30 fps).
            "T1": 8.5 / 30, "T2": 13 / 30, "T3_letter": 2.5 / 30, "T5_step": 14 / 30, "T6": 4.5 / 30,
            "card_in": 11 / 30, "defocus": 7 / 30, "lead_in_delay": 4 / 30,
            "sfx_db": -8, "music_db": -20,
        },
    }
    out_dir = proj / "ae"
    out_dir.mkdir(exist_ok=True)
    js = "// Сгенерировано _build/ae_export.py — не править руками, правьте inserts.json / clip.plan.json\n"
    js += "var CLIP = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    (out_dir / "clip_data.jsxinc").write_text(js, encoding="utf-8")

    print(f"кусков: {len(pieces)}, групп субтитров: {len(subs)}, вставок: {len(inserts)}, SFX: {len(kept)}, "
          f"акцентов: {len(accents)}")
    share = sum(x["t_out"] - x["t_in"] for x in inserts) / dur
    print(f"доля вставок: {share * 100:.0f} % (гайд 30–40 %)")
    for g in subs:
        print(f"  {g['t_in']:6.2f}–{g['t_out']:6.2f}  " + " ".join(("*" + w["w"] + "*") if w.get("accent") else w["w"] for w in g["words"]))
    print(f"→ {out_dir / 'clip_data.jsxinc'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
