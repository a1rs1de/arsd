import React from 'react';
import {interpolateColors} from 'remotion';

/** Размер SVG смайла, px (лицо r=170 + белая обводка-стикер). */
export const SMILEY_BOX = 400;
const C = SMILEY_BOX / 2;
const FACE_R = 170;
const OUTLINE = 8;
const INK = '#5A3414'; // брови, глаза, рот — тёмно-коричневые, как у эмодзи

/** Мимика: всё числами, чтобы плавно смешивать эмоции. */
export type Expr = {
	browL: {y: number; a: number}; // y: <0 — выше; a: >0 — внутренний край вниз (злость), <0 — вверх (испуг/вина)
	browR: {y: number; a: number};
	eyeH: number; //    высота глаз (1 — обычно, <1 — прищур, >1 — распахнуты)
	pupil: {dx: number; dy: number}; // взгляд
	mouthCurve: number; // −1 грусть … +1 улыбка
	mouthOpen: number; //  0 закрыт … 1 широко открыт
	mouthW: number; //     ширина рта, доля от обычной
	mouthDx: number; //    сдвиг рта вбок (озадаченность)
	blush: number; //      румянец 0…1 (вина)
};

export const EXPR: Record<string, Expr> = {
	calm: {browL: {y: 0, a: -4}, browR: {y: 0, a: -4}, eyeH: 1, pupil: {dx: 0, dy: 0}, mouthCurve: 0.75, mouthOpen: 0, mouthW: 1, mouthDx: 0, blush: 0},
	surprise: {browL: {y: -24, a: -10}, browR: {y: -24, a: -10}, eyeH: 1.3, pupil: {dx: 0, dy: -2}, mouthCurve: 0, mouthOpen: 0.95, mouthW: 0.42, mouthDx: 0, blush: 0},
	puzzled: {browL: {y: -18, a: -12}, browR: {y: 4, a: 14}, eyeH: 0.95, pupil: {dx: 6, dy: -4}, mouthCurve: -0.15, mouthOpen: 0, mouthW: 0.6, mouthDx: 18, blush: 0},
	displeased: {browL: {y: 4, a: 12}, browR: {y: 4, a: 12}, eyeH: 0.85, pupil: {dx: 0, dy: 0}, mouthCurve: -0.55, mouthOpen: 0, mouthW: 0.75, mouthDx: 0, blush: 0},
	angry: {browL: {y: 8, a: 28}, browR: {y: 8, a: 28}, eyeH: 0.72, pupil: {dx: 0, dy: 2}, mouthCurve: -0.9, mouthOpen: 0.35, mouthW: 0.95, mouthDx: 0, blush: 0},
	furious: {browL: {y: 12, a: 34}, browR: {y: 12, a: 34}, eyeH: 0.6, pupil: {dx: 0, dy: 3}, mouthCurve: -1, mouthOpen: 0.55, mouthW: 1.05, mouthDx: 0, blush: 0},
	scared: {browL: {y: -26, a: -24}, browR: {y: -26, a: -24}, eyeH: 1.38, pupil: {dx: 0, dy: 0}, mouthCurve: -0.3, mouthOpen: 0.7, mouthW: 0.55, mouthDx: 0, blush: 0},
	guilty: {browL: {y: -6, a: -18}, browR: {y: -6, a: -18}, eyeH: 0.9, pupil: {dx: -5, dy: 7}, mouthCurve: -0.4, mouthOpen: 0, mouthW: 0.55, mouthDx: 0, blush: 0.9},
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function mixExpr(a: Expr, b: Expr, t: number): Expr {
	return {
		browL: {y: lerp(a.browL.y, b.browL.y, t), a: lerp(a.browL.a, b.browL.a, t)},
		browR: {y: lerp(a.browR.y, b.browR.y, t), a: lerp(a.browR.a, b.browR.a, t)},
		eyeH: lerp(a.eyeH, b.eyeH, t),
		pupil: {dx: lerp(a.pupil.dx, b.pupil.dx, t), dy: lerp(a.pupil.dy, b.pupil.dy, t)},
		mouthCurve: lerp(a.mouthCurve, b.mouthCurve, t),
		mouthOpen: lerp(a.mouthOpen, b.mouthOpen, t),
		mouthW: lerp(a.mouthW, b.mouthW, t),
		mouthDx: lerp(a.mouthDx, b.mouthDx, t),
		blush: lerp(a.blush, b.blush, t),
	};
}

function mouthPath(e: Expr): string {
	const w = 120 * e.mouthW;
	const cx = C + e.mouthDx;
	const y = C + 62;
	const x0 = cx - w / 2;
	const x1 = cx + w / 2;
	const bend = e.mouthCurve * 46; // >0 — уголки вверх (центр ниже)
	if (e.mouthOpen < 0.05) {
		return `M ${x0} ${y - bend * 0.35} Q ${cx} ${y + bend} ${x1} ${y - bend * 0.35}`;
	}
	const open = e.mouthOpen * 70;
	const top = y - bend * 0.35;
	// верхняя губа повторяет изгиб, нижняя — ниже на «открытость»
	return (
		`M ${x0} ${top} Q ${cx} ${y + bend - open * 0.55} ${x1} ${top} ` +
		`Q ${cx} ${y + bend + open} ${x0} ${top} Z`
	);
}

function Brow({x, y, a, mirror}: {x: number; y: number; a: number; mirror: boolean}) {
	// у левой брови внутренний край справа, у правой — слева
	const rot = mirror ? -a : a;
	return (
		<g transform={`translate(${x} ${y}) rotate(${rot})`}>
			<path d="M -34 4 Q 0 -10 34 4" stroke={INK} strokeWidth={15} strokeLinecap="round" fill="none" />
		</g>
	);
}

/**
 * Объёмный мультяшный смайл. redness 0…1 — жёлтый → красный.
 */
export const Smiley: React.FC<{expr: Expr; redness: number}> = ({expr: e, redness}) => {
	const light = interpolateColors(redness, [0, 1], ['#FFF09A', '#FF9A84']);
	const mid = interpolateColors(redness, [0, 1], ['#FFCC33', '#F2452E']);
	const edge = interpolateColors(redness, [0, 1], ['#F2A20C', '#C21E14']);
	const eyeRy = 25 * e.eyeH;
	const eyeY = C - 22;
	const mouthFill = e.mouthOpen >= 0.05;
	return (
		<svg width={SMILEY_BOX} height={SMILEY_BOX} viewBox={`0 0 ${SMILEY_BOX} ${SMILEY_BOX}`} style={{overflow: 'visible'}}>
			<defs>
				<radialGradient id="face-grad" cx="0.4" cy="0.35" r="0.75">
					<stop offset="0" stopColor={light} />
					<stop offset="0.55" stopColor={mid} />
					<stop offset="1" stopColor={edge} />
				</radialGradient>
				<radialGradient id="face-shade" cx="0.5" cy="0.95" r="0.7">
					<stop offset="0" stopColor="rgba(120,40,0,0.22)" />
					<stop offset="1" stopColor="rgba(120,40,0,0)" />
				</radialGradient>
				<filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation={7} />
				</filter>
				<clipPath id="face-clip">
					<circle cx={C} cy={C} r={FACE_R} />
				</clipPath>
			</defs>
			{/* белая обводка-стикер */}
			<circle cx={C} cy={C} r={FACE_R + OUTLINE} fill="#ffffff" />
			<circle cx={C} cy={C} r={FACE_R} fill="url(#face-grad)" />
			<circle cx={C} cy={C} r={FACE_R} fill="url(#face-shade)" />
			{/* блик */}
			<g clipPath="url(#face-clip)">
				<ellipse cx={C - 62} cy={C - 92} rx={58} ry={30} transform={`rotate(-28 ${C - 62} ${C - 92})`} fill="#ffffff" opacity={0.6} filter="url(#soft)" />
			</g>
			{/* румянец */}
			<ellipse cx={C - 92} cy={C + 34} rx={30} ry={17} fill="#FF6F8E" opacity={0.55 * e.blush} filter="url(#soft)" />
			<ellipse cx={C + 92} cy={C + 34} rx={30} ry={17} fill="#FF6F8E" opacity={0.55 * e.blush} filter="url(#soft)" />
			{/* глаза */}
			{[-1, 1].map((s) => (
				<g key={s}>
					<ellipse cx={C + s * 58 + e.pupil.dx} cy={eyeY + e.pupil.dy} rx={18} ry={eyeRy} fill={INK} />
					<ellipse cx={C + s * 58 + e.pupil.dx - 6} cy={eyeY + e.pupil.dy - eyeRy * 0.45} rx={6} ry={Math.max(3, 7 * e.eyeH)} fill="#ffffff" opacity={0.9} />
				</g>
			))}
			{/* брови */}
			<Brow x={C - 60} y={C - 78 + e.browL.y} a={e.browL.a} mirror={false} />
			<Brow x={C + 60} y={C - 78 + e.browR.y} a={e.browR.a} mirror />
			{/* рот */}
			<path
				d={mouthPath(e)}
				fill={mouthFill ? '#6B2410' : 'none'}
				stroke={INK}
				strokeWidth={mouthFill ? 8 : 13}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
};
