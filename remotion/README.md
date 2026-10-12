# Remotion — анимации-оверлеи

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
