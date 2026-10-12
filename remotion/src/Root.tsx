import React from 'react';
import {Composition} from 'remotion';
import {DeadlineDisc, DeadlineDiscProps, DURATION, FPS} from './deadline-disc/DeadlineDisc';

/**
 * Позиция всей анимации в кадре 1080×1920 — defaultProps ниже (или --props при рендере):
 *   x, y  — центр композиции, px; по умолчанию верх кадра (занято примерно y 250–850), лицо в центре открыто;
 *   scale — масштаб всей композиции.
 */
const defaults: DeadlineDiscProps = {x: 540, y: 550, scale: 1, checkerboard: false};

export const RemotionRoot: React.FC = () => (
	<>
		<Composition
			id="DeadlineDisc"
			component={DeadlineDisc}
			width={1080}
			height={1920}
			fps={FPS}
			durationInFrames={DURATION}
			defaultProps={defaults}
		/>
		<Composition
			id="DeadlineDiscPreview"
			component={DeadlineDisc}
			width={1080}
			height={1920}
			fps={FPS}
			durationInFrames={DURATION}
			defaultProps={{...defaults, checkerboard: true}}
		/>
	</>
);
