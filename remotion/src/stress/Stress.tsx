/**
 * «СТРЕСС»: смайл злится, стресс-метр зашкаливает, штамп «НЕЛЬЗЯ» — оверлей для Reels
 * (1080×1920, 29.97 fps, 246 кадров, прозрачный фон). Вторая анимация серии после «ДЕДЛАЙН».
 *
 * Все тайминги — в кадрах при 29.97 fps — в блоке T ниже: сдвигайте их под звук.
 * Позиция всей композиции — props x, y, scale (см. Root.tsx), по умолчанию верх кадра (y ≈ 200–800), лицо в центре открыто.
 */
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {clamp, easeInOut, easeOut, impactShake, jitter, popIn} from '../shared/anim';
import {checkerStyle, FPS_2997} from '../shared/checker';
import {useInterBlack} from '../shared/fonts';
import {STICKER_SHADOW} from '../shared/Sticker';
import {AngerMark, Bolt, burst, Steam} from './Effects';
import {NoSign, SIGN_SIZE} from './NoSign';
import {EXPR, mixExpr, Smiley, SMILEY_BOX} from './Smiley';
import {METER_H, METER_W, StressMeter} from './StressMeter';

// ───────────────────────────── ТАЙМИНГ (кадры, 29.97 fps) ─────────────────────────────
export const T = {
	// 1. «стресс — это такие» — смайл и метр появляются, всё спокойно
	SMILEY_IN: 0, //             pop-in: scale 0 → 110 % …
	SMILEY_IN_PEAK: 5,
	SMILEY_IN_END: 8, //         … → 100 %
	METER_IN: 4, //              метр — с задержкой в 4 кадра
	METER_IN_PEAK: 9,
	METER_IN_END: 12,

	// 2. «эмоции, когда человек» — смайл перебирает эмоции, стрелка ползёт в жёлтую зону
	SURPRISE: 58,
	PUZZLED: 73,
	DISPLEASED: 88,
	NEEDLE_TO_YELLOW_START: 56,
	NEEDLE_TO_YELLOW_END: 107,
	EXPR_BLEND: 4, //            за сколько кадров меняется выражение

	// 3. «злится» — краснеет, брови вниз, пар, стрелка прыгает в красное, тряска
	ANGRY: 107,
	REDDEN_END: 117, //          жёлтый → красный за 10 кадров
	NEEDLE_JUMP_END: 114,
	SHAKE_PX: 3.5,

	// 4. «и может сделать всё, что» — злость нарастает
	FURIOUS: 135,
	INFLATE_END: 206, //         смайл раздувается до 112 % к этому кадру
	INFLATE_SCALE: 1.12,
	NEEDLE_MAX_AT: 150, //       стрелка упирается в максимум и дрожит
	ANGER_MARKS: [135, 147, 160, 172, 186], // когда выскакивают знаки 💢
	BOLTS: [140, 152, 164, 177, 190, 198], //  когда сверкают молнии

	// 5. «нельзя» — штамп
	STAMP_START: 206, //         знак влетает: scale 300 % → 100 %
	STAMP_HIT: 210, //           удар
	STAMP_SHAKE_FRAMES: 3,
	STAMP_SHAKE_PX: 7,
	SCARED: 207, //              смайл замирает испуганным

	// 6. «даже делать» — сдувается, краснота уходит, виноватый вид, стрелка в зелёное
	DEFLATE_START: 220,
	DEFLATE_END: 236,
	DEFLATE_SCALE: 0.95,
	GUILTY: 221,
	CALM_COLOR_END: 232,
	NEEDLE_DROP_END: 232,

	// 7. исчезновение
	OUT_START: 236,
	OUT_END: 246,
} as const;
// ──────────────────────────────────────────────────────────────────────────────────────

export const STRESS_FPS = FPS_2997;
export const STRESS_DURATION = 246;
export const STAGE_W = 1080; // «сцена» в своих координатах; x/y/scale ставят её центр в кадр
export const STAGE_H = 600;

// Где что стоит на сцене
const SMILEY = {x: 300, y: 300}; //   центр смайла
const METER = {x: 820, y: 316}; //    центр стресс-метра
const SIGN = {x: 612, y: 292}; //     центр знака «НЕЛЬЗЯ» (правее — испуганное лицо смайла остаётся видно)
const SIGN_SCALE = 0.9; //            размер знака (1 = 520 px)
const SIGN_DROP = 320; //             знак влетает сверху: начальный сдвиг вверх, px
const SIGN_ROT = -10; //              наклон штампа, градусы

export type StressProps = {
	/** центр композиции по X в кадре, px */
	x: number;
	/** центр композиции по Y в кадре, px (по умолчанию 500: занято примерно 200–800) */
	y: number;
	/** масштаб всей композиции */
	scale: number;
	/** шахматный фон — только для превью */
	checkerboard?: boolean;
};

const EXPR_KEYS: [number, keyof typeof EXPR, number][] = [
	// [кадр, выражение, кадров на переход]
	[0, 'calm', 1],
	[T.SURPRISE, 'surprise', T.EXPR_BLEND],
	[T.PUZZLED, 'puzzled', T.EXPR_BLEND],
	[T.DISPLEASED, 'displeased', T.EXPR_BLEND],
	[T.ANGRY, 'angry', T.EXPR_BLEND],
	[T.FURIOUS, 'furious', 8],
	[T.SCARED, 'scared', 2], //   замирает — почти мгновенно
	[T.GUILTY, 'guilty', 8],
];

function expressionAt(f: number) {
	let i = 0;
	while (i + 1 < EXPR_KEYS.length && f >= EXPR_KEYS[i + 1][0]) i++;
	const [at, name, blend] = EXPR_KEYS[i];
	const prev = i > 0 ? EXPR[EXPR_KEYS[i - 1][1]] : EXPR[name];
	const t = interpolate(f, [at, at + blend], [0, 1], {...clamp, easing: easeInOut});
	return mixExpr(prev, EXPR[name], t);
}

function needleAt(f: number): number {
	if (f < T.NEEDLE_TO_YELLOW_START) return 0.12 + 0.012 * Math.sin(f / 6);
	if (f < T.ANGRY) return interpolate(f, [T.NEEDLE_TO_YELLOW_START, T.NEEDLE_TO_YELLOW_END], [0.12, 0.5], {...clamp, easing: easeInOut});
	if (f < T.NEEDLE_JUMP_END) return interpolate(f, [T.ANGRY, T.ANGRY + 3, T.NEEDLE_JUMP_END], [0.5, 0.93, 0.84], clamp);
	if (f < T.FURIOUS) return 0.84 + jitter(f, 0.012, 3);
	if (f < T.NEEDLE_MAX_AT) return interpolate(f, [T.FURIOUS, T.NEEDLE_MAX_AT], [0.84, 1], {...clamp, easing: easeOut});
	if (f < T.DEFLATE_START) return 1 - Math.abs(jitter(f, f < T.STAMP_START ? 0.035 : 0.012, 5));
	return interpolate(f, [T.DEFLATE_START, T.NEEDLE_DROP_END - 2, T.NEEDLE_DROP_END + 2], [0.98, 0.07, 0.12], {...clamp, easing: easeOut});
}

export const Stress: React.FC<StressProps> = ({x, y, scale, checkerboard}) => {
	useInterBlack(['СТРЕСС', 'НЕЛЬЗЯ']);
	const f = useCurrentFrame();

	// ── смайл ──
	const smileyPop = popIn(f, T.SMILEY_IN, T.SMILEY_IN_PEAK, T.SMILEY_IN_END, 1.1);
	const inflate =
		f < T.DEFLATE_START
			? interpolate(f, [T.FURIOUS, T.INFLATE_END], [1, T.INFLATE_SCALE], {...clamp, easing: Easing.in(Easing.quad)})
			: interpolate(f, [T.DEFLATE_START, T.DEFLATE_END - 4, T.DEFLATE_END], [T.INFLATE_SCALE, T.DEFLATE_SCALE * 0.98, T.DEFLATE_SCALE], {
					...clamp,
					easing: easeOut,
				});
	const shaking = f >= T.ANGRY && f < T.STAMP_START;
	const shakeAmp = f >= T.FURIOUS ? T.SHAKE_PX + 0.5 : T.SHAKE_PX;
	const sx = shaking ? jitter(f, shakeAmp, 1) : 0;
	const sy = shaking ? jitter(f, shakeAmp, 2) : 0;
	const redness =
		f < T.DEFLATE_START
			? interpolate(f, [T.ANGRY, T.REDDEN_END], [0, 1], clamp)
			: interpolate(f, [T.DEFLATE_START, T.CALM_COLOR_END], [1, 0], clamp);
	const expr = expressionAt(f);
	const sScale = smileyPop * inflate;

	// ── метр ──
	const meterPop = popIn(f, T.METER_IN, T.METER_IN_PEAK, T.METER_IN_END, 1.1);
	const needle = needleAt(f);
	const glow = f >= T.NEEDLE_MAX_AT && f < T.DEFLATE_START ? 0.55 + 0.45 * Math.sin(f / 2.2) : 0;

	// ── пар, 💢, молнии ──
	const earX = 172 * sScale;
	const steamSides = [
		{x: SMILEY.x - earX, y: SMILEY.y - 10, dir: -1 as const},
		{x: SMILEY.x + earX, y: SMILEY.y - 10, dir: 1 as const},
	];
	const steamBursts = [
		{from: T.ANGRY + 3, to: T.FURIOUS, period: 6, size: 24},
		{from: T.FURIOUS, to: T.STAMP_START, period: 3, size: 34},
	];
	const marks = [
		{x: SMILEY.x + 175, y: SMILEY.y - 150, size: 64, rot: 10},
		{x: SMILEY.x - 180, y: SMILEY.y - 140, size: 56, rot: -15},
		{x: SMILEY.x + 205, y: SMILEY.y + 20, size: 50, rot: 25},
		{x: SMILEY.x - 210, y: SMILEY.y + 40, size: 54, rot: -5},
		{x: SMILEY.x + 10, y: SMILEY.y - 228, size: 58, rot: 0},
	];
	const bolts = [
		{x: SMILEY.x - 120, y: SMILEY.y - 215, size: 98, rot: -20},
		{x: SMILEY.x + 130, y: SMILEY.y - 215, size: 92, rot: 18},
		{x: SMILEY.x - 245, y: SMILEY.y - 50, size: 86, rot: -35},
		{x: SMILEY.x + 250, y: SMILEY.y - 70, size: 88, rot: 30},
		{x: SMILEY.x - 150, y: SMILEY.y + 175, size: 80, rot: -160},
		{x: SMILEY.x + 160, y: SMILEY.y + 170, size: 80, rot: 155},
	];
	const hideFx = f >= T.STAMP_START; // штамп — эффекты исчезают, смайл замирает

	// ── штамп «НЕЛЬЗЯ» ──
	const signVisible = f >= T.STAMP_START;
	const signScale =
		f < T.STAMP_HIT
			? interpolate(f, [T.STAMP_START, T.STAMP_HIT], [3, 1], {...clamp, easing: Easing.in(Easing.quad)})
			: interpolate(f, [T.STAMP_HIT, T.STAMP_HIT + 2, T.STAMP_HIT + 5], [1, 0.95, 1], clamp);
	const signOpacity = interpolate(f, [T.STAMP_START, T.STAMP_START + 1.5], [0, 1], clamp);
	const signRot = interpolate(f, [T.STAMP_START, T.STAMP_HIT], [SIGN_ROT - 8, SIGN_ROT], clamp);
	const signDrop = interpolate(f, [T.STAMP_START, T.STAMP_HIT], [-SIGN_DROP, 0], {...clamp, easing: Easing.in(Easing.quad)});
	const hit = impactShake(f, T.STAMP_HIT, T.STAMP_SHAKE_FRAMES, T.STAMP_SHAKE_PX);

	// ── уход ──
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
					transform: `translate(${hit.x}px, ${hit.y}px) scale(${scale * outScale})`,
					transformOrigin: '50% 50%',
					opacity: outOpacity,
				}}
			>
				{/* стресс-метр */}
				<div
					style={{
						position: 'absolute',
						left: METER.x - METER_W / 2,
						top: METER.y - METER_H / 2,
						width: METER_W,
						height: METER_H,
						transform: `scale(${meterPop})`,
						transformOrigin: '50% 70%',
					}}
				>
					<StressMeter value={needle} glow={glow} />
				</div>

				{/* смайл */}
				<div
					style={{
						position: 'absolute',
						left: SMILEY.x - SMILEY_BOX / 2,
						top: SMILEY.y - SMILEY_BOX / 2,
						width: SMILEY_BOX,
						height: SMILEY_BOX,
						transform: `translate(${sx}px, ${sy}px) scale(${sScale})`,
						transformOrigin: '50% 50%',
						filter: STICKER_SHADOW,
					}}
				>
					<Smiley expr={expr} redness={redness} />
				</div>

				{/* пар, знаки злости, молнии */}
				{!hideFx && (
					<svg
						width={STAGE_W}
						height={STAGE_H}
						viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
						style={{position: 'absolute', inset: 0, overflow: 'visible', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.25))'}}
					>
						<Steam frame={f} sides={steamSides} bursts={steamBursts} />
						{marks.map((m, i) => {
							const at = T.ANGER_MARKS[i];
							const pop = at === undefined ? 0 : burst(f, at, T.STAMP_START - at - 5);
							return (
								<AngerMark key={i} x={m.x + sx} y={m.y + sy} size={m.size} rot={m.rot} pop={pop} pulse={Math.sin((f - (at ?? 0)) / 2.5)} />
							);
						})}
						{bolts.map((b, i) => {
							const at = T.BOLTS[i];
							const pop = at === undefined ? 0 : burst(f, at, 8);
							const flicker = (f - (at ?? 0)) % 4 === 2 ? 0.55 : 1;
							return <Bolt key={i} x={b.x} y={b.y} size={b.size} rot={b.rot + jitter(f, 6, i)} pop={pop} flicker={flicker} />;
						})}
					</svg>
				)}

				{/* штамп «НЕЛЬЗЯ» */}
				{signVisible && (
					<div
						style={{
							position: 'absolute',
							left: SIGN.x - SIGN_SIZE / 2,
							top: SIGN.y - SIGN_SIZE / 2,
							width: SIGN_SIZE,
							height: SIGN_SIZE,
							transform: `translateY(${signDrop}px) rotate(${signRot}deg) scale(${signScale * SIGN_SCALE})`,
							transformOrigin: '50% 50%',
							opacity: signOpacity,
							filter: STICKER_SHADOW,
						}}
					>
						<NoSign />
					</div>
				)}
			</div>
		</AbsoluteFill>
	);
};
