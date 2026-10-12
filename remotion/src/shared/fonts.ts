import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import '@fontsource/inter/900.css';

/** Ждём Inter Black (с кириллицей) до рендера кадра. samples — строки, которые точно будут на экране. */
export function useInterBlack(samples: string[]) {
	const [handle] = useState(() => delayRender('Inter Black'));
	useEffect(() => {
		Promise.all(samples.map((s) => document.fonts.load('900 72px Inter', s)))
			.then(() => continueRender(handle))
			.catch(() => continueRender(handle));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [handle]);
}
