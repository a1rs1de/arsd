// Общие помощники анимации для оверлеев серии (дедлайн, стресс, …).
import {Easing, interpolate} from 'remotion';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const easeInOut = Easing.inOut(Easing.cubic);
export const easeOut = Easing.out(Easing.cubic);

/** Pop-in стикера: 0 → peak (с overshoot) → 1. start — кадр начала, peakAt/endAt — кадры пика и конца. */
export function popIn(frame: number, start: number, peakAt: number, endAt: number, peak = 1.1): number {
	return frame < peakAt
		? interpolate(frame, [start, peakAt], [0, peak], {...clamp, easing: easeOut})
		: interpolate(frame, [peakAt, endAt], [peak, 1], {...clamp, easing: easeInOut});
}

/** Детерминированная «дрожь» (одинакова при каждом рендере): смещение ±amp px. */
export function jitter(frame: number, amp: number, seed = 0): number {
	const s = Math.sin((frame + 1) * 12.9898 + seed * 78.233) * 43758.5453;
	return ((s - Math.floor(s)) * 2 - 1) * amp;
}

/** Тряска при ударе: последовательность смещений на несколько кадров после start. */
export function impactShake(frame: number, start: number, frames: number, px: number): {x: number; y: number} {
	const i = frame - start;
	if (i < 0 || i > frames) return {x: 0, y: 0};
	const seq = [px, -px, px * 0.6, -px * 0.4, px * 0.2, 0];
	const k = Math.min(i, seq.length - 1);
	return {x: seq[k], y: i % 2 === 0 ? -px * 0.4 : px * 0.4};
}

/** Квадратичная кривая Безье (траектории полёта). */
export function bezier(a: number, c: number, b: number, t: number): number {
	return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
}
