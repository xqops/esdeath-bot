const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const BIN_DIR = path.join(__dirname, '..', '..', 'bin');
const YT_DLP_PATH = path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const DOWNLOAD_URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${path.basename(YT_DLP_PATH)}`;

// O YouTube exige um "motor" de JavaScript; usa o próprio Node que roda o bot.
const BASE_ARGS = ['--js-runtimes', `node:${process.execPath}`, '--no-warnings'];

/**
 * Garante que o yt-dlp existe (baixa se faltar) e tenta atualizar em segundo plano.
 * Atualizar sempre é o que conserta quando o YouTube muda alguma coisa.
 */
async function ensureYtDlp() {
  if (!fs.existsSync(YT_DLP_PATH)) {
    console.log('[música] baixando yt-dlp...');
    fs.mkdirSync(BIN_DIR, { recursive: true });
    const response = await fetch(DOWNLOAD_URL);
    if (!response.ok) throw new Error(`Não consegui baixar o yt-dlp (HTTP ${response.status}).`);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(YT_DLP_PATH, { mode: 0o755 }));
  }

  const update = spawn(YT_DLP_PATH, ['-U']);
  let output = '';
  update.stdout.on('data', (chunk) => { output += chunk; });
  update.on('close', () => {
    const lastLine = output.trim().split('\n').pop();
    if (lastLine) console.log(`[música] yt-dlp: ${lastLine}`);
  });
}

// Roda o yt-dlp até o fim e devolve a saída (com limite de tempo).
function runYtDlp(args, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP_PATH, [...BASE_ARGS, ...args]);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => proc.kill(), timeoutMs);
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    proc.on('error', reject);
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

// Inicia o download do áudio mandando os dados pelo stdout (pra tocar enquanto baixa).
function spawnAudioDownload(url) {
  return spawn(YT_DLP_PATH, [...BASE_ARGS, '--quiet', '-f', 'bestaudio/best', '-o', '-', url]);
}

// Transforma o erro do yt-dlp numa frase curta pra mostrar no Discord.
function describeYtDlpError(stderr) {
  if (/HTTP Error 429|Too Many Requests/i.test(stderr)) {
    return 'o YouTube está limitando o bot agora (muitos pedidos). Tenta de novo daqui a alguns minutos.';
  }
  if (/Sign in to confirm/i.test(stderr)) return 'o YouTube pediu verificação de que não é robô. Tenta de novo mais tarde.';
  if (/Private video/i.test(stderr)) return 'esse vídeo é privado.';
  if (/unavailable|does not exist|not found|404/i.test(stderr)) return 'não encontrei (o link está certo e é público?).';
  const lastError = stderr.split('\n').reverse().find((line) => line.startsWith('ERROR:'));
  return lastError ? lastError.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?([\w-]+:\s*)?/, '') : 'erro desconhecido.';
}

module.exports = { ensureYtDlp, runYtDlp, spawnAudioDownload, describeYtDlpError };
