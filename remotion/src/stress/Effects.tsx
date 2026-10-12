import React from 'react';
import {interpolate} from 'remotion';
import {clamp, jitter} from '../shared/anim';

/* Мультяшные эффекты злости — всё в координатах сцены (px). Ничего «грубого»: пар, 💢-знаки, молнии. */

// ───────── пар из «ушей» ─────────
export type SteamSide = {x: number; y: number; dir: 1 | -1};

/**
 * Клубы пара: каждый рождается через period кадров, живёт life кадров, летит вбок и вверх, растёт и тает.
 * Интенсивность задаётся графиком bursts: [{from, to, period, size}].
 */
export const Steam: React.FC<{
	frame: number;
	sides: SteamSide[];
	bursts: {from: number; to: number; period: number; size: number}[];
	life?: number;
}> = ({frame, sides, bursts, life = 20}) => {
	const puffs: React.ReactNode[] = [];
	bursts.forEach((b, bi) => {
		for (let birth = b.from; birth < b.to; birth += b.period) {
			const age = frame - birth;
			if (age < 0 || age > life) continue;
			const u = age / life;
			sides.forEach((s, si) => {
				const wob = Math.sin((birth + si * 7) * 1.7) * 10;
				const x = s.x + s.dir * (age * 4.2 + 6) + wob * 0.4;
				const y = s.y - age * 3.6 + wob * 0.3;
				const r = b.size * (0.45 + u * 0.9);
				const o = interpolate(u, [0, 0.15, 0.6, 1], [0, 1, 0.9, 0], clamp);
				puffs.push(
					<g key={`${bi}-${birth}-${si}`} opacity={o}>
						<circle cx={x} cy={y} r={r + 5} fill="#ffffff" />
						<circle cx={x} cy={y + r * 0.18} r={r} fill="#DDE3EA" />
						<circle cx={x - r * 0.15} cy={y - r * 0.1} r={r * 0.82} fill="#ffffff" />
					</g>,
				);
			});
		}
	});
	return <>{puffs}</>;
};

// ───────── знак злости 💢 (рисуем сами, не эмодзи-шрифтом) ─────────
const VEIN = 'M -22 -7 Q -8 -7 -7 -22'; // одна «скобка», повторяется 4 раза с поворотом

export const AngerMark: React.FC<{x: number; y: number; size: number; pop: number; pulse: number; rot: number}> = ({
	x,
	y,
	size,
	pop,
	pulse,
	rot,
}) => {
	if (pop <= 0) return null;
	const s = (size / 50) * pop * (1 + 0.14 * pulse);
	return (
		<g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
			{[0, 90, 180, 270].map((a) => (
				<path key={`w${a}`} d={VEIN} transform={`rotate(${a})`} stroke="#ffffff" strokeWidth={19} strokeLinecap="round" fill="none" />
			))}
			{[0, 90, 180, 270].map((a) => (
				<path key={`r${a}`} d={VEIN} transform={`rotate(${a})`} stroke="#E53935" strokeWidth={10} strokeLinecap="round" fill="none" />
			))}
		</g>
	);
};

// ───────── маленькая молния ─────────
const BOLT = 'M 6 -34 L -14 2 L 0 2 L -8 34 L 16 -6 L 2 -6 L 10 -34 Z';

export const Bolt: React.FC<{x: number; y: number; size: number; pop: number; rot: number; flicker: number}> = ({
	x,
	y,
	size,
	pop,
	rot,
	flicker,
}) => {
	if (pop <= 0) return null;
	const s = (size / 68) * pop;
	return (
		<g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={flicker}>
			<path d={BOLT} fill="#ffffff" stroke="#ffffff" strokeWidth={16} strokeLinejoin="round" />
			<path d={BOLT} fill="#FFD21F" stroke="#F08A00" strokeWidth={4} strokeLinejoin="round" />
		</g>
	);
};

/** Появление-исчезновение эффекта: pop-in за 5 кадров, держится hold, уходит за 5 кадров. */
export function burst(frame: number, at: number, hold: number): number {
	if (frame < at || frame > at + hold + 5) return 0;
	if (frame < at + 3) return interpolate(frame, [at, at + 3], [0, 1.2], clamp);
	if (frame < at + 5) return interpolate(frame, [at + 3, at + 5], [1.2, 1], clamp);
	return interpolate(frame, [at + hold, at + hold + 5], [1, 0], clamp);
}

export {jitter};
