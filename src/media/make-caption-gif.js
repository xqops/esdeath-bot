const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { runFfmpeg } = require('./ffmpeg');
const { downloadMedia } = require('./fetch-media');
const { renderCaptionBar } = require('./caption-bar');

const MAX_SECONDS = 15;
const MIN_WIDTH = 240;
// Tentativas em ordem: se o gif passar do limite do Discord, tenta menor.
const ATTEMPTS = [
  { maxWidth: 480, maxFps: 20 },
  { maxWidth: 360, maxFps: 15 },
  { maxWidth: 280, maxFps: 12 },
];

async function isWebp(filePath) {
  const file = await fs.open(filePath);
  try {
    const { buffer } = await file.read(Buffer.alloc(12), 0, 12, 0);
    return buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP';
  } finally {
    await file.close();
  }
}

// O ffmpeg não lê webp animado, então o sharp converte pra gif antes (mantendo o tempo dos quadros).
async function convertWebpToGif(inputPath, workDir) {
  const gifPath = path.join(workDir, 'input.gif');
  // Só carrega o sharp quando aparece um webp (economiza memória no resto do tempo).
  const sharp = require('sharp');
  sharp.cache(false);
  // Passa o conteúdo (e não o caminho) pro sharp não deixar o arquivo travado no Windows.
  await sharp(await fs.readFile(inputPath), { animated: true }).gif({ effort: 10 }).toFile(gifPath);
  return gifPath;
}

// Lê largura, altura e fps do arquivo pela saída do ffmpeg.
async function probe(inputPath) {
  const { stderr } = await runFfmpeg(['-i', inputPath]);
  const videoLine = stderr.split('\n').find((line) => /Stream .*Video:/.test(line));
  if (!videoLine) throw new Error('Não consegui ler esse arquivo como gif/vídeo.');

  const size = videoLine.match(/, (\d{2,5})x(\d{2,5})/);
  const fps = videoLine.match(/([\d.]+) fps/);
  return {
    width: size ? Number(size[1]) : 480,
    fps: fps ? Number(fps[1]) : 15,
  };
}

async function encode(inputPath, text, source, attempt, workDir) {
  const width = Math.max(MIN_WIDTH, Math.min(source.width, attempt.maxWidth));
  const fps = Math.min(source.fps || attempt.maxFps, attempt.maxFps);

  const barPath = path.join(workDir, 'bar.png');
  await fs.writeFile(barPath, renderCaptionBar(text, width));

  // Uma thread só: um pouco mais lento, mas gasta bem menos memória com vídeo (mp4).
  const inputs = [
    '-filter_threads', '1', '-threads', '1', '-t', String(MAX_SECONDS), '-i', inputPath,
    '-i', barPath,
  ];
  const stack = [
    `[0:v]fps=${fps},scale=${width}:-2:flags=lanczos,setsar=1,format=rgb24[gif]`,
    '[1:v]format=rgb24[bar]',
    // A faixa é um quadro só (repetido até o fim), assim o ritmo segue só o gif.
    '[bar][gif]vstack=inputs=2',
  ].join(';');

  // Duas passadas (paleta antes, gif depois) em vez de uma com `split`: o `split` guarda
  // todos os quadros na memória até a paleta ficar pronta (~300 MB num gif de 15s).
  const palettePath = path.join(workDir, 'palette.png');
  await ffmpegOrFail([
    ...inputs,
    '-filter_complex', `${stack},palettegen=stats_mode=diff`,
    '-frames:v', '1', '-update', '1', palettePath,
  ]);

  const outputPath = path.join(workDir, `out-${width}.gif`);
  await ffmpegOrFail([
    ...inputs, '-i', palettePath,
    '-filter_complex', `${stack}[v];[v][2:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    '-loop', '0',
    // Sem isso o último quadro pode sair com 1cs, que o Discord trava em 10cs.
    '-final_delay', String(Math.round(100 / fps)),
    outputPath,
  ]);

  return outputPath;
}

async function ffmpegOrFail(args) {
  const { code, stderr } = await runFfmpeg(args);
  if (code !== 0) {
    console.error(stderr);
    throw new Error('Deu ruim ao montar o gif.');
  }
}

/**
 * Junta o texto (faixa branca em cima) com o gif/vídeo e devolve o gif final.
 * @param {{ url: string, text: string, maxBytes: number }} options
 * @returns {Promise<Buffer>}
 */
// Um gif por vez: dois ffmpeg juntos passariam do limite de memória da hospedagem.
let queue = Promise.resolve();

function makeCaptionGif(options) {
  const job = queue.then(() => buildCaptionGif(options));
  queue = job.catch(() => {});
  return job;
}

async function buildCaptionGif({ url, text, maxBytes }) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'esdeath-'));
  try {
    let inputPath = path.join(workDir, 'input');
    await downloadMedia(url, inputPath);
    if (await isWebp(inputPath)) inputPath = await convertWebpToGif(inputPath, workDir);
    const source = await probe(inputPath);

    for (const attempt of ATTEMPTS) {
      const outputPath = await encode(inputPath, text, source, attempt, workDir);
      const { size } = await fs.stat(outputPath);
      if (size <= maxBytes) return fs.readFile(outputPath);
    }

    throw new Error('O gif ficou grande demais pro Discord. Tenta um gif mais curto.');
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

module.exports = { makeCaptionGif };
