#!/usr/bin/env python3
"""Синтетический клип 1080×1920 для проверки check_face.py.

Лицо — тестовое фото из OpenCV (lena.jpg), 4 плана как в composition.example.json:
  A1 0–4 с     глаза y≈640, подбородок ≈900        → всё в порядке
  A2 4–7,5 с   глаза y≈790, подбородок ≈1050       → кадрирование (не зона субтитров)
  A3 7,5–11 с  крупный, глаза y≈800, подбородок ≈1215 → крупный план + зона субтитров
  V1 11–12 с   вставка без лица
Запуск: _build/.venv/bin/python _build/tests/make_test_video.py face.jpg out.mp4
"""
import sys

import cv2
import numpy as np

W, H, FPS = 1080, 1920, 30
EYES, CHIN = 266, 388  # координаты на lena.jpg 512×512 (MediaPipe)

face = cv2.imread(sys.argv[1])
out = cv2.VideoWriter(sys.argv[2], cv2.VideoWriter_fourcc(*"mp4v"), FPS, (W, H))


def place(scale, eyes_y, push=1.0):
    s = scale * push
    img = cv2.resize(face, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
    canvas = np.full((H, W, 3), 60, np.uint8)
    oy = int(round(eyes_y - EYES * s))
    ox = int(round(W / 2 - 256 * s))
    y0, x0 = max(oy, 0), max(ox, 0)
    y1, x1 = min(oy + img.shape[0], H), min(ox + img.shape[1], W)
    canvas[y0:y1, x0:x1] = img[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    return canvas


shots = [(0, 4, 2.1, 640), (4, 7.5, 2.1, 790), (7.5, 11, 3.4, 800)]
for a, b, scale, eyes in shots:
    n = int((b - a) * FPS)
    for i in range(n):
        out.write(place(scale, eyes, 1 + 0.03 * i / n))  # медленный наезд 100→103 %
for i in range(FPS):  # вставка: красный экран
    frame = np.full((H, W, 3), (3, 0, 132), np.uint8)
    cv2.putText(frame, "381", (300, 960), cv2.FONT_HERSHEY_DUPLEX, 8, (245, 252, 253), 12)
    out.write(frame)
out.release()
