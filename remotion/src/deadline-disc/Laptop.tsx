import React from 'react';

/** Где стоит ноутбук на сцене (1080×600), px. */
export const LAPTOP_BOX = {left: 540, top: 110, width: 460, height: 400};

// Щель дисковода — на передней грани корпуса (координаты ноутбука)
const SLOT_LOCAL = {x: 100, y: 354, w: 260, h: 12};
/** Центр щели на сцене — сюда летит диск. */
export const SLOT = {
	x: LAPTOP_BOX.left + SLOT_LOCAL.x + SLOT_LOCAL.w / 2,
	y: LAPTOP_BOX.top + SLOT_LOCAL.y + SLOT_LOCAL.h / 2,
	w: SLOT_LOCAL.w,
};

const SCREEN = {x: 66, y: 28, w: 328, h: 208, r: 12};

/**
 * Стилизованный ноутбук спереди-сверху: тёмно-серый корпус, щель дисковода на передней грани,
 * белая обводка-стикер 7 px, мягкая тень. Экран: выключен / вспышка / кнопка «ИГРАТЬ».
 */
export const Laptop: React.FC<{
	screenOn: boolean;
	flash: number; // 0…1 — белая вспышка при включении
	playScale: number; // масштаб кнопки (0 — нет кнопки)
	playGlow: number; // 0…1 — фаза пульсации для свечения
	frame: number;
}> = ({screenOn, flash, playScale, playGlow}) => {
	const {width: W, height: H} = LAPTOP_BOX;
	return (
		<div style={{position: 'absolute', inset: 0, filter: 'drop-shadow(0 16px 20px rgba(0,0,0,0.35))'}}>
			<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
				<defs>
					<filter id="sticker-outline" x="-10%" y="-10%" width="120%" height="120%">
						<feMorphology in="SourceAlpha" operator="dilate" radius={7} result="dil" />
						<feFlood floodColor="#ffffff" />
						<feComposite in2="dil" operator="in" result="outline" />
						<feMerge>
							<feMergeNode in="outline" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
					<linearGradient id="lid" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="#4a515c" />
						<stop offset="1" stopColor="#30353d" />
					</linearGradient>
					<linearGradient id="deck" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="#5d6571" />
						<stop offset="1" stopColor="#474e58" />
					</linearGradient>
					<linearGradient id="front" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="#363b43" />
						<stop offset="1" stopColor="#24282e" />
					</linearGradient>
				</defs>
				<g filter="url(#sticker-outline)">
					{/* крышка */}
					<rect x={50} y={12} width={360} height={240} rx={24} fill="url(#lid)" />
					<rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx={SCREEN.r} fill="#0d1014" />
					{/* петля */}
					<rect x={70} y={246} width={320} height={16} rx={7} fill="#22262c" />
					{/* верх корпуса (клавиатура в перспективе) */}
					<path d="M50 258 L410 258 L452 330 L8 330 Z" fill="url(#deck)" />
					<path d="M92 267 L368 267 L388 300 L72 300 Z" fill="#3a3f48" />
					<rect x={192} y={306} width={76} height={18} rx={6} fill="#4f5662" />
					{/* передняя грань со щелью */}
					<path d="M8 330 L452 330 L452 376 Q452 394 434 394 L26 394 Q8 394 8 376 Z" fill="url(#front)" />
					<rect x={SLOT_LOCAL.x} y={SLOT_LOCAL.y} width={SLOT_LOCAL.w} height={SLOT_LOCAL.h} rx={5} fill="#08090b" />
					<line
						x1={SLOT_LOCAL.x + 6}
						y1={SLOT_LOCAL.y + SLOT_LOCAL.h + 3}
						x2={SLOT_LOCAL.x + SLOT_LOCAL.w - 6}
						y2={SLOT_LOCAL.y + SLOT_LOCAL.h + 3}
						stroke="rgba(255,255,255,0.22)"
						strokeWidth={2}
						strokeLinecap="round"
					/>
				</g>
			</svg>

			{/* экран */}
			<div
				style={{
					position: 'absolute',
					left: SCREEN.x,
					top: SCREEN.y,
					width: SCREEN.w,
					height: SCREEN.h,
					borderRadius: SCREEN.r,
					overflow: 'hidden',
					background: screenOn
						? 'radial-gradient(circle at 50% 40%, #3b2a7a 0%, #1d1a4a 55%, #0d0f2a 100%)'
						: 'linear-gradient(160deg, #1a1d23 0%, #0c0e12 100%)',
				}}
			>
				{/* отражение на стекле */}
				<div
					style={{
						position: 'absolute',
						inset: 0,
						background:
							'linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.07) 42%, rgba(255,255,255,0) 54%)',
					}}
				/>
				{screenOn && playScale > 0 && (
					<div
						style={{
							position: 'absolute',
							left: '50%',
							top: '50%',
							transform: `translate(-50%, -50%) scale(${playScale})`,
							display: 'flex',
							alignItems: 'center',
							gap: 12,
							padding: '14px 26px 14px 22px',
							borderRadius: 999,
							background: 'linear-gradient(180deg, #3ee07a 0%, #18a84c 100%)',
							border: '4px solid #ffffff',
							boxShadow: `0 0 ${16 + 22 * playGlow}px rgba(62,224,122,${0.55 + 0.35 * playGlow}), 0 6px 0 rgba(0,0,0,0.25)`,
							whiteSpace: 'nowrap',
						}}
					>
						<svg width={26} height={28} viewBox="0 0 26 28">
							<path d="M4 3 L23 14 L4 25 Z" fill="#ffffff" stroke="#ffffff" strokeWidth={3} strokeLinejoin="round" />
						</svg>
						<span style={{fontFamily: 'Inter', fontWeight: 900, fontSize: 34, color: '#ffffff', letterSpacing: 1}}>
							ИГРАТЬ
						</span>
					</div>
				)}
				{/* вспышка включения */}
				<div style={{position: 'absolute', inset: 0, background: '#ffffff', opacity: flash}} />
			</div>
		</div>
	);
};
