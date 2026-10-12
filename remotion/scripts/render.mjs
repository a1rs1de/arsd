// Рендер оверлеев серии в ../out/<папка>/:
//   <имя>_prores4444.mov — ProRes 4444 с альфой (для Premiere Pro)
//   <имя>_preview.mp4    — превью на шахматном фоне
//   frame_NNN.png        — контрольные кадры (прозрачные)
//
//   node scripts/render.mjs deadline
//   node scripts/render.mjs stress -- --props='{"y":520,"scale":0.9}'
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const PRESETS = {
	deadline: {id: 'DeadlineDisc', preview: 'DeadlineDiscPreview', dir: 'deadline-disc', name: 'deadline-disc', frames: [10, 45, 75, 110, 150]},
	stress: {id: 'Stress', preview: 'StressPreview', dir: 'stress', name: 'stress', frames: [20, 90, 120, 170, 212, 235]},
};

const [key, ...rest] = process.argv.slice(2);
const p = PRESETS[key];
if (!p) {
	console.error(`Укажите анимацию: ${Object.keys(PRESETS).join(' | ')}`);
	process.exit(2);
}
const extra = rest.filter((a) => a !== '--'); // например --props='{"y":600}'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, '..', 'out', p.dir);
mkdirSync(out, {recursive: true});

const common = ['--log=error'];
// Свой Chrome Remotion качает с remotion.media; если сеть не пускает — берём уже установленный.
const browser =
	process.env.REMOTION_BROWSER_EXECUTABLE ||
	['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((f) => existsSync(f));
if (browser) common.push(`--browser-executable=${browser}`);

const run = (args) => {
	console.log('> remotion ' + args.join(' '));
	execFileSync('npx', ['remotion', ...args, ...common, ...extra], {cwd: root, stdio: 'inherit'});
};

// ProRes 4444 с альфой: Remotion отдаёт PNG-кадры, ffmpeg кодирует их одним проходом.
// qscale 9 — визуально без потерь (PSNR ≈ 60 дБ, альфа без потерь), но файл вдвое меньше стандартного
// и укладывается в лимит GitHub 100 МБ. Меньше qscale — выше качество и размер.
const frames = path.join(out, '_frames');
rmSync(frames, {recursive: true, force: true});
run(['render', 'src/index.ts', p.id, frames, '--sequence', '--image-format=png']);
const first = readdirSync(frames).filter((f) => f.endsWith('.png')).sort()[0];
const pattern = first.replace(/\d+(?=\.png$)/, (d) => `%0${d.length}d`);
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const mov = path.join(out, `${p.name}_prores4444.mov`);
console.log('> ffmpeg → ' + mov);
execFileSync(ffmpeg, [
	'-v', 'error', '-y', '-framerate', '30000/1001', '-start_number', String(parseInt(first.match(/(\d+)\.png$/)[1], 10)),
	'-i', path.join(frames, pattern),
	'-c:v', 'prores_ks', '-profile:v', '4444', '-qscale:v', String(p.proresQ ?? 9), '-vendor', 'apl0',
	'-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', mov,
], {stdio: 'inherit'});
rmSync(frames, {recursive: true, force: true});
run([
	'render', 'src/index.ts', p.preview, path.join(out, `${p.name}_preview.mp4`),
	'--codec=h264', '--crf=18', '--image-format=jpeg', '--jpeg-quality=95',
]);
for (const f of p.frames) {
	run(['still', 'src/index.ts', p.id, path.join(out, `frame_${String(f).padStart(3, '0')}.png`), `--frame=${f}`]);
}
console.log('Готово: ' + out);
