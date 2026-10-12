/**
 * «ДЕДЛАЙН»: диск залетает в ноутбук — оверлей для Reels (1080×1920, 29.97 fps, 180 кадров, прозрачный фон).
 *
 * Все тайминги — в кадрах при 29.97 fps — в блоке T ниже: сдвигайте их под звук.
 * Позиция всей композиции — props x, y, scale (см. Root.tsx), по умолчанию верх кадра, лицо в центре не закрыто.
 */
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {bezier, clamp, easeInOut as inOut, easeOut as out, popIn} from '../shared/anim';
import {checkerStyle, FPS_2997} from '../shared/checker';
import {useInterBlack} from '../shared/fonts';
import {Disc, DISC_SIZE} from './Disc';
import {Laptop, LAPTOP_BOX, SLOT} from './Laptop';

// ───────────────────────────── ТАЙМИНГ (кадры, 29.97 fps) ─────────────────────────────
export const T = {
	// 1. «это такая интересная» — диск появляется и висит
	DISC_IN: 0, //               scale 0 → 110 % …
	DISC_IN_PEAK: 5, //          … 110 % …
	DISC_IN_END: 8, //           … → 100 %
	SWAY_PERIOD: 40, //          период покачивания rotateZ, кадры
	SWAY_DEG: 6, //              амплитуда покачивания, ±градусы

	// 2. ноутбук появляется рядом (экран выключен)
	LAPTOP_IN: 40,
	LAPTOP_IN_PEAK: 50, //       105 %
	LAPTOP_IN_END: 55, //        100 %

	// 3. «программа, которую» — диск ложится горизонтально
	TILT_START: 48,
	TILT_END: 80,
	TILT_DEG: 78, //             rotateX в конце поворота
	TILT_SCALE: 0.85, //         масштаб диска в конце поворота

	// 4. «вставляют в планшеты» — полёт по дуге и вход в щель
	FLY_START: 80,
	FLY_END: 106, //             диск перед щелью
	INSERT_END: 120, //          диск целиком внутри корпуса
	SHAKE_START: 109, //         тряска ноутбука в момент входа
	SHAKE_FRAMES: 3,
	SHAKE_PX: 4,

	// 5. «и ноутбуки с играми» — экран включается
	SCREEN_ON: 122, //           вспышка
	FLASH_FRAMES: 3,
	PLAY_IN: 126, //             кнопка «ИГРАТЬ» появляется
	PULSE_PERIOD: 18, //         пульсация кнопки, кадры (~0.6 с)

	// 6. исчезновение
	OUT_START: 171,
	OUT_END: 180,
} as const;
// ──────────────────────────────────────────────────────────────────────────────────────

export const FPS = FPS_2997;
export const DURATION = 180;
export const STAGE_W = 1080; // «сцена» в своих координатах; x/y/scale ставят её центр в кадр
export const STAGE_H = 600;

// Положение диска на сцене (центр) в разные моменты
const DISC_HOME = {x: 315, y: 270};
const SLOT_FRONT = {x: SLOT.x, y: SLOT.y + 18}; // точка перед щелью, куда прилетает диск
const SLOT_INSIDE = {x: SLOT.x, y: SLOT.y - 42}; // центр диска, когда он целиком внутри
const ARC_CONTROL = {x: 610, y: 120}; //          вершина дуги полёта (квадратичная кривая)
const FLY_SCALE = 0.58; //                         масштаб у щели (диск уже щели)
const INSIDE_SCALE = 0.5;

export type DeadlineDiscProps = {
	/** центр композиции по X в кадре, px */
	x: number;
	/** центр композиции по Y в кадре, px (по умолчанию 550: занято примерно 250–850) */
	y: number;
	/** масштаб всей композиции */
	scale: number;
	/** шахматный фон — только для превью */
	checkerboard?: boolean;
};

export const DeadlineDisc: React.FC<DeadlineDiscProps> = ({x, y, scale, checkerboard}) => {
	useInterBlack(['ДЕДЛАЙН', 'ИГРАТЬ']);
	const f = useCurrentFrame();

	// ── диск: появление, покачивание ──
	const appear = popIn(f, T.DISC_IN, T.DISC_IN_PEAK, T.DISC_IN_END, 1.1);
	const swayFade = interpolate(f, [T.DISC_IN_END, T.DISC_IN_END + 6, T.TILT_START, T.TILT_START + 12], [0, 1, 1, 0], clamp);
	const sway = Math.sin(((f - T.DISC_IN_END) / T.SWAY_PERIOD) * Math.PI * 2) * T.SWAY_DEG * swayFade;

	// ── поворот в горизонталь ──
	const tilt = interpolate(f, [T.TILT_START, T.TILT_END], [0, 1], {...clamp, easing: inOut});
	const rotX = tilt * T.TILT_DEG;
	let discScale = appear * interpolate(tilt, [0, 1], [1, T.TILT_SCALE]);

	// ── полёт по дуге и вход в щель ──
	let dx = DISC_HOME.x;
	let dy = DISC_HOME.y;
	if (f >= T.FLY_START) {
		const u = interpolate(f, [T.FLY_START, T.FLY_END], [0, 1], {...clamp, easing: inOut});
		dx = bezier(DISC_HOME.x, ARC_CONTROL.x, SLOT_FRONT.x, u);
		dy = bezier(DISC_HOME.y, ARC_CONTROL.y, SLOT_FRONT.y, u);
		discScale = interpolate(u, [0, 1], [T.TILT_SCALE, FLY_SCALE]);
	}
	const inserting = f >= T.FLY_END;
	if (inserting) {
		const v = interpolate(f, [T.FLY_END, T.INSERT_END], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
		dy = interpolate(v, [0, 1], [SLOT_FRONT.y, SLOT_INSIDE.y]);
		discScale = interpolate(v, [0, 1], [FLY_SCALE, INSIDE_SCALE]);
	}
	const discVisible = f < T.INSERT_END + 1;
	// блик проходит по диску во время поворота (и коротко после появления)
	const glint =
		f < T.TILT_START
			? interpolate(f, [T.DISC_IN_END + 2, T.DISC_IN_END + 18], [0, 1], clamp)
			: interpolate(f, [T.TILT_START, T.TILT_END], [0, 1], clamp);

	// ── ноутбук ──
	const laptopScale = popIn(f, T.LAPTOP_IN, T.LAPTOP_IN_PEAK, T.LAPTOP_IN_END, 1.05);
	const shakeSeq = [0, T.SHAKE_PX, -T.SHAKE_PX, T.SHAKE_PX * 0.6, 0];
	const si = f - T.SHAKE_START;
	const shakeX = si >= 0 && si <= T.SHAKE_FRAMES + 1 ? shakeSeq[Math.min(si, shakeSeq.length - 1)] : 0;
	const shakeY = si >= 0 && si <= T.SHAKE_FRAMES ? (si % 2 === 0 ? -2 : 2) : 0;

	// ── экран ──
	const screenOn = f >= T.SCREEN_ON;
	const flash = interpolate(f, [T.SCREEN_ON, T.SCREEN_ON + 1, T.SCREEN_ON + T.FLASH_FRAMES], [0, 1, 0], clamp);
	const playIn =
		f < T.PLAY_IN + 6
			? interpolate(f, [T.PLAY_IN, T.PLAY_IN + 6], [0, 1.1], {...clamp, easing: out})
			: interpolate(f, [T.PLAY_IN + 6, T.PLAY_IN + 10], [1.1, 1], {...clamp, easing: inOut});
	const pulsePhase = f >= T.PLAY_IN + 10 ? (1 - Math.cos(((f - T.PLAY_IN - 10) / T.PULSE_PERIOD) * Math.PI * 2)) / 2 : 0;
	const playScale = playIn * (1 + 0.08 * pulsePhase);

	// ── общий уход ──
	const outScale = interpolate(f, [T.OUT_START, T.OUT_END], [1, 0.9], {...clamp, easing: Easing.in(Easing.cubic)});
	const outOpacity = interpolate(f, [T.OUT_START, T.OUT_END - 1], [1, 0], clamp);

	return (
		<AbsoluteFill style={checkerboard ? checkerStyle : undefined}>
			<div
				style={{
					position: 'absolute',
					width: STAGE_W,
					height: STAGE_H,
					left: x - STAGE_W / 2,
					top: y - STAGE_H / 2,
					transform: `scale(${scale * outScale})`,
					transformOrigin: '50% 50%',
					opacity: outOpacity,
				}}
			>
				{/* ноутбук */}
				<div
					style={{
						position: 'absolute',
						left: LAPTOP_BOX.left,
						top: LAPTOP_BOX.top,
						width: LAPTOP_BOX.width,
						height: LAPTOP_BOX.height,
						transform: `translate(${shakeX}px, ${shakeY}px) scale(${laptopScale})`,
						transformOrigin: '50% 80%',
					}}
				>
					<Laptop screenOn={screenOn} flash={flash} playScale={playScale} playGlow={pulsePhase} frame={f} />
				</div>

				{/* диск; при входе в щель видна только часть ниже линии щели (остальное уже в корпусе) */}
				{discVisible && (
					<div
						style={{
							position: 'absolute',
							inset: 0,
							perspective: 1100,
							perspectiveOrigin: `${dx}px ${dy - 120}px`,
							clipPath: inserting ? `inset(${SLOT.y}px 0 0 0)` : undefined,
							filter: 'drop-shadow(0 14px 16px rgba(0,0,0,0.35))',
						}}
					>
						<div
							style={{
								position: 'absolute',
								left: dx - DISC_SIZE / 2,
								top: dy - DISC_SIZE / 2,
								width: DISC_SIZE,
								height: DISC_SIZE,
								transform: `rotateX(${rotX}deg) rotateZ(${sway}deg) scale(${discScale})`,
								transformStyle: 'preserve-3d',
							}}
						>
							<Disc glint={glint} frame={f} tilt={tilt} />
						</div>
					</div>
				)}
			</div>
		</AbsoluteFill>
	);
};
