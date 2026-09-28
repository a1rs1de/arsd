#!/usr/bin/env bash
# Локальная установка для скриптов _build/: venv + MediaPipe/OpenCV + модель лица.
# Запуск из корня репозитория: bash _build/setup.sh
set -euo pipefail
cd "$(dirname "$0")"

python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

mkdir -p models
MODEL=models/face_landmarker.task
if [ ! -s "$MODEL" ]; then
  curl -sSLf -o "$MODEL" \
    https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
fi

# На голом Linux MediaPipe требует libEGL/libGLESv2 (на macOS/Windows не нужно).
if [ "$(uname)" = "Linux" ] && ! ldconfig -p 2>/dev/null | grep -q libEGL.so.1; then
  echo "Нет libEGL: sudo apt-get install -y libegl1 libgles2" >&2
fi

echo "Готово: _build/.venv/bin/python _build/check_face.py --help"
