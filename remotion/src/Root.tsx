import React from 'react';
import {Composition} from 'remotion';
import {DeadlineDisc, DeadlineDiscProps, DURATION, FPS} from './deadline-disc/DeadlineDisc';
import {Stress, STRESS_DURATION, STRESS_FPS, StressProps} from './stress/Stress';

/**
 * Позиция всей анимации в кадре 1080×1920 — defaultProps ниже (или --props при рендере):
 *   x, y  — центр композиции, px; по умолчанию верх кадра (занято примерно y 250–850), лицо в центре открыто;
 *   scale — масштаб всей композиции.
 */
const defaults: DeadlineDiscProps = {x: 540, y: 550, scale: 1, checkerboard: false};

/** «СТРЕСС»: по умолчанию верх кадра, занято примерно y 200–800. */
const stressDefaults: StressProps = {x: 540, y: 500, scale: 1, checkerboard: false};

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
		<Composition
			id="Stress"
			component={Stress}
			width={1080}
			height={1920}
			fps={STRESS_FPS}
			durationInFrames={STRESS_DURATION}
			defaultProps={stressDefaults}
		/>
		<Composition
			id="StressPreview"
			component={Stress}
			width={1080}
			height={1920}
			fps={STRESS_FPS}
			durationInFrames={STRESS_DURATION}
			defaultProps={{...stressDefaults, checkerboard: true}}
		/>
	</>
);
