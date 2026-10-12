import {Config} from '@remotion/cli/config';

// Кадры в PNG — чтобы сохранялась прозрачность (альфа) для ProRes 4444.
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
