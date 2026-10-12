# Remotion — анимации-оверлеи

Серия прозрачных оверлеев для Reels (1080×1920, 29.97 fps). Общие вещи — в `src/shared/`:
`Sticker.tsx` (белая обводка-стикер и тень), `anim.ts` (pop-in, тряска, дрожь, кривые), `fonts.ts` (Inter Black),
`checker.ts` (шахматный фон превью). Рендер любой анимации — `scripts/render.mjs <имя>`.

| Анимация | Код | Рендер | Результат |
|---|---|---|---|
| «ДЕДЛАЙН» (диск → ноутбук) | `src/deadline-disc/` | `npm run render:deadline` | `out/deadline-disc/` |
| «СТРЕСС» (смайл злится → «НЕЛЬЗЯ») | `src/stress/` | `npm run render:stress` | `out/stress/` |

ProRes 4444 собирается из PNG-кадров через ffmpeg (`-qscale:v 9`): визуально без потерь, альфа без потерь, файл вдвое меньше
стандартного Remotion и помещается в лимит GitHub 100 МБ. Нужен `ffmpeg` в PATH (или переменная `FFMPEG`).

## «ДЕДЛАЙН»: диск залетает в ноутбук

Оверлей для Reels: 1080×1920, 29.97 fps (30000/1001), 180 кадров (6,0 с), прозрачный фон.
Код: `src/deadline-disc/` — `DeadlineDisc.tsx` (тайминг, движение), `Disc.tsx` (диск), `Laptop.tsx` (ноутбук).

### Рендер

```bash
cd remotion
npm install                 # один раз
npm run render:deadline     # всё сразу → ../out/deadline-disc/
```

Результат в `out/deadline-disc/`:

| Файл | Что |
|---|---|
| `deadline-disc_prores4444.mov` | ProRes 4444 с альфой — класть поверх видео в Premiere Pro |
| `deadline-disc_preview.mp4` | превью на шахматном фоне |
| `frame_010.png`, `frame_045.png`, `frame_075.png`, `frame_110.png`, `frame_150.png` | контрольные кадры с прозрачностью |

Посмотреть и подвигать вживую: `npm run studio` (откроется Remotion Studio в браузере).

Remotion сам скачивает Chrome. Если сеть не пускает — укажите свой: `REMOTION_BROWSER_EXECUTABLE=/путь/к/chrome npm run render:deadline`.

### Тайминг

Блок `T` в начале `src/deadline-disc/DeadlineDisc.tsx` — все ключевые кадры (при 29.97 fps):
появление диска, покачивание, появление ноутбука, поворот в горизонталь, полёт к щели, вход, тряска,
включение экрана, пульсация кнопки, исчезновение. Сдвигайте числа под звук и перерендерьте.

Там же ниже — траектория: `DISC_HOME` (где висит диск), `ARC_CONTROL` (вершина дуги), `FLY_SCALE`/`INSIDE_SCALE`.

### Позиция в кадре

Props `x`, `y`, `scale` — центр всей композиции в кадре и масштаб. По умолчанию `x: 540, y: 550, scale: 1`
(занято примерно y 250–850, центр кадра с лицом открыт). Поменять навсегда — `defaults` в `src/Root.tsx`,
разово — при рендере:

```bash
npm run render:deadline -- --props='{"x":540,"y":600,"scale":0.9}'
```

Шрифт — Inter Black (`@fontsource/inter`, OFL), диск и ноутбук нарисованы в SVG/CSS, внешних ассетов нет.

## «СТРЕСС»: смайл злится, стресс-метр зашкаливает, штамп «НЕЛЬЗЯ»

1080×1920, 29.97 fps, 246 кадров (8,2 с), прозрачный фон. Код: `src/stress/` — `Stress.tsx` (тайминг, движение),
`Smiley.tsx` (смайл и мимика), `StressMeter.tsx` (спидометр), `NoSign.tsx` (знак), `Effects.tsx` (пар, 💢, молнии).

```bash
cd remotion
npm run render:stress                                         # всё → ../out/stress/
npm run render:stress -- --props='{"x":540,"y":520,"scale":0.9}'   # сдвинуть/масштабировать
```

Результат в `out/stress/`: `stress_prores4444.mov` (ProRes 4444 с альфой), `stress_preview.mp4` (шахматный фон),
`frame_020/090/120/170/212/235.png` (контрольные кадры с прозрачностью).

- **Тайминг** — блок `T` в начале `src/stress/Stress.tsx`: появление, смена эмоций, покраснение, пар, 💢 и молнии
  (`ANGER_MARKS`, `BOLTS` — списки кадров), раздувание, штамп и удар, сдувание, уход.
  Последовательность эмоций — `EXPR_KEYS` чуть ниже, сами эмоции (брови, глаза, рот) — `EXPR` в `Smiley.tsx`.
- **Расстановка на сцене** — `SMILEY`, `METER`, `SIGN`, `SIGN_SCALE` в `Stress.tsx`.
- **Позиция в кадре** — props `x`, `y`, `scale`, по умолчанию `540 / 500 / 1` (занято примерно y 200–800, центр с лицом открыт):
  насовсем — `stressDefaults` в `src/Root.tsx`, разово — `--props`.

