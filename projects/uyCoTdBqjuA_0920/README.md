# Reels: uyCoTdBqjuA, 9:20–11:20 → «From good to great»

Исходник: YouTube `uyCoTdBqjuA`, отрезок 9:20–11:20 (`source/uyCoTdBqjuA_0920-1120.mp4`, 1920×1080, 23,976 fps, в git не хранится).
Референс стиля: `reference/reference.mp4` (в git не хранится), разбор ниже.

## Статус

| Шаг (гайд, раздел 14) | Статус |
|---|---|
| 1. Выбор момента (3.1) | ✅ `clip.plan.json` |
| 2. Чистка речи (3.2) | ✅ паузы > 0,3 с вырезаны, `work/edit.json` |
| 3. Reframe (4.1) | ✅ глаза y≈640, подбородок ≤ 965, вшитые субтитры исходника обрезаны; `check_face.py` — 0 замечаний |
| 4. Цвет (4.3) | ⏳ на сборке |
| 5. Звук (12) | ⏳ |
| 6. Субтитры (6) | ⏳ текст готов, тайминг слов приблизительный (см. ниже) |
| 7. Вставки (8–9) | ⏳ ждём материалы — [ASSETS.md](ASSETS.md) |
| 8–10. Переходы, SFX, проверка, экспорт | ⏳ |

## Момент

Одна мысль: **уметь вовремя переключаться с хорошего на великое — главный навык**. Хук вынесен вперёд (3.1).

| # | Роль | Исходник, с | Текст |
|---|---|---|---|
| 1 | хук | 65,28–72,58 | Knowing when to switch from the good to the great is the greatest opportunity, or is the greatest skill that you can develop as a man in your 20s, 30s, for the rest of your career |
| 2 | контекст | 0,00–6,08 | When we were selling booty bands… we were the number one selling booty band business in America. |
| 3 | суть | 12,85–21,63 | It was time to move on. I had logical data… a greater opportunity, such as greens, powders, or beverage. |
| 4 | суть | 25,70–37,86 | Greens: total addressable market can't really get larger than a quarter billion dollars a year. Energy drink: multi-ten, multi-deca billion dollar opportunity. |
| 5 | вывод | 53,33–56,72 | That's why I move on to larger challenges. |
| 6 | вывод | 72,60–76,30 | and I continue to practice that muscle as I age. |

Длительность после чистки ≈ 41 с. Концовка «as I age» → хук «Knowing when to switch…» — петля (13).

## Разбор референса

Референс — разбор стиля «минималистичные ролики в белом стиле»: это **S2 «Белая редакционная карточка»** из гайда (R2). Берём:

- Белая карточка со скруглением, по центру; за ней тёмный фон — у нас затемнённый размытый спикер.
- Чёрные треугольные «осколки» в противоположных углах с лёгкой хроматической аберрацией.
- Тонкие серые окружности через всю карточку, сетка за объектом, штрихкод и QR мелко в углах, уголки-кадрирование.
- Объект — **чёрно-белый** вырез с мягкой тенью (купюры, монета, мозг), пунктирный круг вокруг.
- Типографика: мелкая подводка + огромное слово («improve your / **Skills**», «Then charge / **premium**»), курсив поверх («how much I» над «Charge»), мелкий абзац снизу.
- Список справа от карточки: пункты по очереди со звёздочками (Clean / Minimal / Super satisfying).
- Движение: карточки въезжают из расфокуса, смена карточки ≈ каждые 2 с, пункты списка ≈ 0,5 с.

Отличия от референса, по гайду: звёздочки и акценты **без фиолетового** — только чёрный / белый (палитра 8.1, по просьбе — ч/б стиль); вместо фиолетового градиента — затемнённый спикер.

## Субтитры: откуда текст

Whisper в облачной сессии недоступен (HuggingFace закрыт сетевой политикой). Текст снят OCR с вшитых субтитров исходника (`work/burned_subs.json` → вычитан в `work/phrases.json`), время слов — выравнивание pocketsphinx (`_build/align.py`, `work/words.json`). Время фраз надёжное, **время отдельных слов местами приблизительное** — перед финалом прогнать `_build/transcribe.py` (Whisper) на ПК или сдвинуть вручную.

## Как пересобрать

```
_build/.venv/bin/python _build/roughcut.py projects/uyCoTdBqjuA_0920/clip.plan.json --render
_build/.venv/bin/python _build/check_face.py projects/uyCoTdBqjuA_0920/renders/rough_preview.mp4
```
