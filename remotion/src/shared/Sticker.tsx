import React from 'react';

/** Белая обводка «как у стикеров» вокруг SVG-группы: <g filter="url(#id)">. Радиус 6–8 px. */
export const StickerOutlineFilter: React.FC<{id: string; radius?: number}> = ({id, radius = 7}) => (
	<filter id={id} x="-15%" y="-15%" width="130%" height="130%">
		<feMorphology in="SourceAlpha" operator="dilate" radius={radius} result="dil" />
		<feFlood floodColor="#ffffff" />
		<feComposite in2="dil" operator="in" result="outline" />
		<feMerge>
			<feMergeNode in="outline" />
			<feMergeNode in="SourceGraphic" />
		</feMerge>
	</filter>
);

/** Мягкая тень стикера (CSS filter на обёртке). */
export const STICKER_SHADOW = 'drop-shadow(0 16px 20px rgba(0,0,0,0.35))';
