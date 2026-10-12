import React from 'react';
import {StickerOutlineFilter} from '../shared/Sticker';

/** Размер SVG знака «НЕЛЬЗЯ», px. */
export const SIGN_SIZE = 520;
const C = SIGN_SIZE / 2;
const R = 220; // радиус кольца по центру линии
const RING = 50;
const RED = '#E3201B';

/** Большой красный знак запрета (кольцо с диагональю) с надписью «НЕЛЬЗЯ». */
export const NoSign: React.FC = () => (
	<svg width={SIGN_SIZE} height={SIGN_SIZE} viewBox={`0 0 ${SIGN_SIZE} ${SIGN_SIZE}`} style={{overflow: 'visible'}}>
		<defs>
			<StickerOutlineFilter id="sign-outline" radius={8} />
		</defs>
		<g filter="url(#sign-outline)">
			{/* лёгкая белая подложка внутри — знак читается поверх любого фона, смайл под ним виден */}
			<circle cx={C} cy={C} r={R} fill="rgba(255,255,255,0.18)" />
			<circle cx={C} cy={C} r={R} fill="none" stroke={RED} strokeWidth={RING} />
			<rect x={C - R} y={C - RING / 2} width={R * 2} height={RING} fill={RED} transform={`rotate(45 ${C} ${C})`} />
		</g>
		{/* НЕЛЬЗЯ — белые буквы с красной обводкой (и внешней белой — как стикер) */}
		<text
			x={C}
			y={C + 34}
			textAnchor="middle"
			fontFamily="Inter"
			fontWeight={900}
			fontSize={104}
			letterSpacing={2}
			fill="#ffffff"
			stroke="#ffffff"
			strokeWidth={26}
			strokeLinejoin="round"
			paintOrder="stroke"
		>
			НЕЛЬЗЯ
		</text>
		<text
			x={C}
			y={C + 34}
			textAnchor="middle"
			fontFamily="Inter"
			fontWeight={900}
			fontSize={104}
			letterSpacing={2}
			fill="#ffffff"
			stroke={RED}
			strokeWidth={12}
			strokeLinejoin="round"
			paintOrder="stroke"
		>
			НЕЛЬЗЯ
		</text>
	</svg>
);
