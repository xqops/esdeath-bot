const { spawn } = require('node:child_process');
const fs = require('node:fs');
const ffmpegStatic = require('ffmpeg-static');

// Se a hospedagem não baixou o ffmpeg do npm, usa o do sistema (APT=ffmpeg no Discloud).
const ffmpegPath = ffmpegStatic && fs.existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg';

// Roda o ffmpeg até o fim e devolve o código de saída e o log (stderr).
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ['-hide_banner', '-y', ...args]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code, stderr }));
  });
}

// Inicia o ffmpeg mandando a saída pelo stdout (pra tocar enquanto converte).
// Com `readStdin`, a entrada vem pelo stdin (ex.: áudio vindo do yt-dlp).
function spawnFfmpeg(args, { readStdin = false } = {}) {
  return spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...args], {
    stdio: [readStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
  });
}

module.exports = { runFfmpeg, spawnFfmpeg };
