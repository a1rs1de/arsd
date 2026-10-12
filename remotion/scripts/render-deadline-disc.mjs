// Рендер оверлея «ДЕДЛАЙН» в ../out/deadline-disc/:
//   deadline-disc_prores4444.mov  — ProRes 4444 с альфой (для Premiere Pro)
//   deadline-disc_preview.mp4     — превью на шахматном фоне
//   frame_010.png … frame_150.png — контрольные кадры (прозрачные)
//
//   npm run render:deadline
//   npm run render:deadline -- --props='{"x":540,"y":600,"scale":0.9}'   — сдвинуть/масштабировать
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, '..', 'out', 'deadline-disc');
mkdirSync(out, {recursive: true});

const extra = process.argv.slice(2); // например --props='{"y":600}'
const common = ['--log=error'];
// Свой Chrome Remotion качает с remotion.media; если сеть не пускает — берём уже установленный.
const browser =
	process.env.REMOTION_BROWSER_EXECUTABLE ||
	['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((p) => existsSync(p));
if (browser) common.push(`--browser-executable=${browser}`);

const run = (args) => {
	console.log('> remotion ' + args.join(' '));
	execFileSync('npx', ['remotion', ...args, ...common, ...extra], {cwd: root, stdio: 'inherit'});
};

run([
	'render', 'src/index.ts', 'DeadlineDisc', path.join(out, 'deadline-disc_prores4444.mov'),
	'--codec=prores', '--prores-profile=4444', '--image-format=png', '--pixel-format=yuva444p10le',
]);
run([
	'render', 'src/index.ts', 'DeadlineDiscPreview', path.join(out, 'deadline-disc_preview.mp4'),
	'--codec=h264', '--crf=18', '--image-format=jpeg', '--jpeg-quality=95',
]);
for (const f of [10, 45, 75, 110, 150]) {
	run(['still', 'src/index.ts', 'DeadlineDisc', path.join(out, `frame_${String(f).padStart(3, '0')}.png`), `--frame=${f}`]);
}
console.log('Готово: ' + out);
