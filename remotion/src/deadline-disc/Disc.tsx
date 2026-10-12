import React from 'react';

/** Диаметр диска на сцене, px (вместе с белой обводкой-стикером). */
export const DISC_SIZE = 380;

const RIM = 7; // белая обводка «стикера», px
const R = DISC_SIZE / 2;
const HOLE_R = DISC_SIZE * 0.075; // центральное отверстие
const HUB_R = DISC_SIZE * 0.2; // прозрачная втулка
const RED = '#E3201B';

const round: React.CSSProperties = {position: 'absolute', borderRadius: '50%'};

/**
 * CD/DVD: серебро с радужным переливом, отверстие (настоящая прозрачность), тонкое кольцо,
 * надпись «ДЕДЛАЙН» над отверстием от левого края до правого, блик.
 * glint 0…1 — положение блика, tilt 0…1 — насколько диск уже повёрнут (перелив сильнее).
 */
const HOLE_MASK = `radial-gradient(circle at 50% 50%, transparent ${HOLE_R}px, #000 ${HOLE_R + 1}px)`;

/** Толщина диска (торец) — слои позади лицевой стороны, видны при наклоне. */
const Thickness: React.FC = () => (
	<>
		<div style={{...round, inset: 0, background: '#ffffff', transform: 'translateZ(-10px)', WebkitMaskImage: HOLE_MASK, maskImage: HOLE_MASK}} />
		<div style={{...round, inset: 3, background: '#8d96a1', transform: 'translateZ(-5px)', WebkitMaskImage: HOLE_MASK, maskImage: HOLE_MASK}} />
	</>
);

export const Disc: React.FC<{glint: number; frame: number; tilt: number}> = ({glint, frame, tilt}) => {
	const hueShift = frame * 1.5 + tilt * 120; // перелив «бежит» при повороте
	const inner = DISC_SIZE - RIM * 2;

	// текст: верхняя половина, базовая линия чуть выше отверстия, ширина ≈ хорда на этой высоте
	const textW = DISC_SIZE * 0.78;
	const fontSize = DISC_SIZE * 0.17;
	const baseline = R - HOLE_R - DISC_SIZE * 0.03;

	return (
		<>
		<Thickness />
		<div
			style={{
				...round,
				inset: 0,
				transform: 'translateZ(0.1px)',
				background: '#ffffff', // обводка-стикер
				WebkitMaskImage: HOLE_MASK,
				maskImage: HOLE_MASK,
			}}
		>
			{/* серебро */}
			<div
				style={{
					...round,
					left: RIM,
					top: RIM,
					width: inner,
					height: inner,
					overflow: 'hidden',
					background:
						'radial-gradient(circle at 50% 50%, #f3f5f8 0%, #d9dee4 38%, #c3cad2 62%, #e8ecf0 82%, #b9c1ca 100%)',
					boxShadow: 'inset 0 0 0 2px rgba(60,70,85,0.18)',
				}}
			>
				{/* радужный перелив */}
				<div
					style={{
						...round,
						inset: 0,
						background: `conic-gradient(from ${hueShift}deg,
							rgba(255,70,150,0.75), rgba(255,205,60,0.7), rgba(80,255,170,0.7),
							rgba(60,180,255,0.75), rgba(165,100,255,0.75), rgba(255,70,150,0.75))`,
						mixBlendMode: 'soft-light',
						opacity: 0.75 + 0.25 * tilt,
					}}
				/>
				{/* концентрические «дорожки» — мягко, без мелочи */}
				<div
					style={{
						...round,
						inset: 0,
						background:
							'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.0) 0px, rgba(255,255,255,0.0) 9px, rgba(255,255,255,0.18) 10px, rgba(255,255,255,0.0) 12px)',
					}}
				/>
				{/* блик */}
				<div
					style={{
						position: 'absolute',
						top: -inner * 0.25,
						left: 0,
						width: inner * 0.55,
						height: inner * 1.5,
						background:
							'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 100%)',
						transform: `translateX(${-inner * 0.7 + glint * inner * 1.6}px) rotate(20deg)`,
						opacity: glint > 0 && glint < 1 ? 0.9 : 0,
						mixBlendMode: 'screen',
					}}
				/>
			</div>

			{/* втулка и тонкое внутреннее кольцо */}
			<div
				style={{
					...round,
					left: R - HUB_R,
					top: R - HUB_R,
					width: HUB_R * 2,
					height: HUB_R * 2,
					background: 'radial-gradient(circle, #f7f9fb 0%, #dfe4ea 70%, #cfd6dd 100%)',
					border: '2px solid rgba(80,90,105,0.35)',
					boxSizing: 'border-box',
				}}
			/>
			<div
				style={{
					...round,
					left: R - HUB_R * 0.62,
					top: R - HUB_R * 0.62,
					width: HUB_R * 1.24,
					height: HUB_R * 1.24,
					border: '2px solid rgba(80,90,105,0.3)',
					boxSizing: 'border-box',
				}}
			/>
			{/* белое кольцо вокруг отверстия — край стикера */}
			<div
				style={{
					...round,
					left: R - HOLE_R - 6,
					top: R - HOLE_R - 6,
					width: (HOLE_R + 6) * 2,
					height: (HOLE_R + 6) * 2,
					background: '#ffffff',
				}}
			/>

			{/* ДЕДЛАЙН */}
			<svg
				width={DISC_SIZE}
				height={DISC_SIZE}
				viewBox={`0 0 ${DISC_SIZE} ${DISC_SIZE}`}
				style={{position: 'absolute', inset: 0, overflow: 'visible'}}
			>
				<text
					x={R}
					y={baseline}
					textAnchor="middle"
					textLength={textW}
					lengthAdjust="spacingAndGlyphs"
					fontFamily="Inter"
					fontWeight={900}
					fontSize={fontSize}
					fill={RED}
					stroke="#ffffff"
					strokeWidth={7}
					strokeLinejoin="round"
					paintOrder="stroke"
				>
					ДЕДЛАЙН
				</text>
			</svg>
		</div>
		</>
	);
};
