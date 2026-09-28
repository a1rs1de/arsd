# arsd

Автоматизация монтажа клипов для подкастов (вертикальные Shorts / Reels / TikTok).

## Документы

- [Стиль монтажа arsd — гайд для каждого клипа](docs/style-guide.md) (v2.1): шрифты, цвета, тайминги, анимации, звук, чек-лист и YAML-спецификация для ИИ и монтажёра (раздел 16).

## Скрипты (`_build/`)

- `bash _build/setup.sh` — локальная установка (venv, MediaPipe, OpenCV, модель Face Landmarker).
- `_build/check_face.py` — проверка лица перед экспортом: каждые 0,5 с и на каждом плане ищет лицо; выдаёт таймкоды, где лицо заходит в зону субтитров (низ рамки ниже y 1160), с отрендеренными кадрами, и планы, где глаза не на y ≈ 640 или подбородок ниже y ≈ 1000. Формат композиции — `_build/composition.example.json`.
- `_build/transcribe.py` — Whisper: текст исходника со временем каждого слова.
- `_build/align.py` — время слов по готовому тексту (SRT, вшитые субтитры), без Whisper.
- `_build/roughcut.py` — черновой монтаж по плану клипа: чистка пауз, reframe 9:16 по лицу, punch-in на склейках, превью.
- `_build/tests/make_test_video.py` — синтетический клип для проверки `check_face.py`.

## Проекты

- [`projects/uyCoTdBqjuA_0920`](projects/uyCoTdBqjuA_0920/README.md) — рилс «From good to great», стиль S2 ч/б. Материалы: [ASSETS.md](projects/uyCoTdBqjuA_0920/ASSETS.md).
