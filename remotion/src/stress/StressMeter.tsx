import React from 'react';
import {STICKER_SHADOW, StickerOutlineFilter} from '../shared/Sticker';

/** Размер SVG стресс-метра, px. */
export const METER_W = 440;
export const METER_H = 330;
const CX = 220;
const CY = 232;
const ARC_R = 162;
const ARC_W = 44;
const SEGMENTS = 48;

const polar = (r: number, deg: number) => {
	const a = (deg * Math.PI) / 180;
	return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};

/**
 * Полукруглый спидометр «СТРЕСС»: шкала зелёный → жёлтый → красный, стрелка.
 * value 0…1 — положение стрелки (0 — крайний зелёный, 1 — максимум), glow 0…1 — красное свечение на максимуме.
 */
export const StressMeter: React.FC<{value: number; glow: number}> = ({value, glow}) => {
	const segs = [];
	for (let i = 0; i < SEGMENTS; i++) {
		const t0 = i / SEGMENTS;
		const t1 = (i + 1.05) / SEGMENTS; // лёгкое перекрытие — без щелей
		const [x0, y0] = polar(ARC_R, 180 + t0 * 180);
		const [x1, y1] = polar(ARC_R, 180 + Math.min(1, t1) * 180);
		const hue = 120 - 120 * ((i + 0.5) / SEGMENTS); // 120 зелёный → 60 жёлтый → 0 красный
		segs.push(
			<path key={i} d={`M ${x0} ${y0} A ${ARC_R} ${ARC_R} 0 0 1 ${x1} ${y1}`} stroke={`hsl(${hue}, 88%, 50%)`} strokeWidth={ARC_W} fill="none" />,
		);
	}
	const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
		const [x0, y0] = polar(ARC_R - ARC_W / 2 - 8, 180 + t * 180);
		const [x1, y1] = polar(ARC_R - ARC_W / 2 - 24, 180 + t * 180);
		return <line key={t} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#2B2F36" strokeWidth={6} strokeLinecap="round" />;
	});
	const needleDeg = (value - 0.5) * 180; // 0 — стрелка вверх
	return (
		<div style={{position: 'absolute', inset: 0, filter: STICKER_SHADOW}}>
			<svg width={METER_W} height={METER_H} viewBox={`0 0 ${METER_W} ${METER_H}`} style={{overflow: 'visible'}}>
				<defs>
					<StickerOutlineFilter id="meter-outline" radius={7} />
					<radialGradient id="meter-glow" cx="0.5" cy="0.7" r="0.6">
						<stop offset="0" stopColor="rgba(255,60,40,0.55)" />
						<stop offset="1" stopColor="rgba(255,60,40,0)" />
					</radialGradient>
				</defs>
				<g filter="url(#meter-outline)">
					{/* корпус: полукруг + плашка снизу под надпись */}
					<path
						d={`M 20 ${CY} A 200 200 0 0 1 420 ${CY} L 420 292 Q 420 314 398 314 L 42 314 Q 20 314 20 292 Z`}
						fill="#FFFCF2"
					/>
					{segs}
					{ticks}
				</g>
				<path d={`M 20 ${CY} A 200 200 0 0 1 420 ${CY} L 420 292 Q 420 314 398 314 L 42 314 Q 20 314 20 292 Z`} fill="url(#meter-glow)" opacity={glow} />
				{/* стрелка */}
				<g transform={`rotate(${needleDeg} ${CX} ${CY})`}>
					<path d={`M ${CX - 13} ${CY} L ${CX} ${CY - ARC_R + 6} L ${CX + 13} ${CY} Z`} fill="#2B2F36" stroke="#2B2F36" strokeWidth={6} strokeLinejoin="round" />
				</g>
				<circle cx={CX} cy={CY} r={24} fill="#2B2F36" />
				<circle cx={CX} cy={CY} r={9} fill="#ffffff" />
				{/* подпись */}
				<text x={CX} y={300} textAnchor="middle" fontFamily="Inter" fontWeight={900} fontSize={40} fill="#2B2F36" letterSpacing={3}>
					СТРЕСС
				</text>
			</svg>
		</div>
	);
};
