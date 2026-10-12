import type React from 'react';

/** Шахматный фон — только для превью .mp4. */
export const checkerStyle: React.CSSProperties = {
	backgroundColor: '#d9d9d9',
	backgroundImage:
		'linear-gradient(45deg, #b8b8b8 25%, transparent 25%), linear-gradient(-45deg, #b8b8b8 25%, transparent 25%),' +
		'linear-gradient(45deg, transparent 75%, #b8b8b8 75%), linear-gradient(-45deg, transparent 75%, #b8b8b8 75%)',
	backgroundSize: '60px 60px',
	backgroundPosition: '0 0, 0 30px, 30px -30px, -30px 0px',
};

/** Общие параметры серии. */
export const FPS_2997 = 30000 / 1001;
export const REEL_W = 1080;
export const REEL_H = 1920;
