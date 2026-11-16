const { isSpotifyUrl, getSpotifyTracks } = require('./spotify');
const { runYtDlp, describeYtDlpError } = require('./yt-dlp');

const MAX_PLAYLIST = 200;

/**
 * @typedef {object} Track
 * @property {string} title
 * @property {string} url Link pro yt-dlp (página, "ytsearch1:...") ou link direto do arquivo.
 * @property {'ytdlp' | 'direct'} source
 * @property {string} [pageUrl] Link pra mostrar no painel.
 * @property {number} [durationSec]
 * @property {string} requestedBy
 */

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

async function resolveSpotify(url, requestedBy) {
  const { name, tracks } = await getSpotifyTracks(url);
  if (!tracks.length) throw new Error('Esse link do Spotify não tem músicas.');

  return {
    // Só tem "nome de playlist" quando vem mais de uma música (link de música avulsa não).
    name: tracks.length > 1 ? name : undefined,
    tracks: tracks.map((track) => ({
      title: track.artists ? `${track.title} — ${track.artists}` : track.title,
      // Procura a música no YouTube só na hora de tocar.
      url: `ytsearch1:${track.title} ${track.artists} audio`,
      source: 'ytdlp',
      durationSec: track.durationMs / 1000,
      requestedBy,
    })),
  };
}

async function resolveUrl(url, requestedBy) {
  // Link de vídeo que veio de dentro de uma playlist: toca só o vídeo.
  const args = ['-J', '--flat-playlist', '--playlist-end', String(MAX_PLAYLIST)];
  if (/[?&]v=/.test(url)) args.push('--no-playlist');

  const { code, stdout, stderr } = await runYtDlp([...args, url]);
  const info = code === 0 ? parseJson(stdout) : null;

  if (!info) {
    // Site que o yt-dlp não conhece (rádio, link direto de mp3...): o ffmpeg tenta tocar direto.
    if (/Unsupported URL/i.test(stderr)) {
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || url;
      return { tracks: [{ title: name, url, pageUrl: url, source: 'direct', requestedBy }] };
    }
    throw new Error(`Não consegui abrir esse link: ${describeYtDlpError(stderr)}`);
  }

  if (info._type === 'playlist') {
    const tracks = (info.entries ?? []).filter(Boolean).map((entry) => ({
      title: entry.title ?? entry.url,
      url: entry.url ?? entry.webpage_url,
      pageUrl: entry.webpage_url ?? entry.url,
      source: 'ytdlp',
      durationSec: entry.duration,
      requestedBy,
    }));
    if (!tracks.length) throw new Error('Essa playlist está vazia (ou é privada).');
    return { name: info.title, tracks };
  }

  return {
    tracks: [{
      title: info.title ?? url,
      url: info.webpage_url ?? url,
      pageUrl: info.webpage_url ?? url,
      source: 'ytdlp',
      durationSec: info.duration,
      requestedBy,
    }],
  };
}

async function resolveSearch(query, requestedBy) {
  const { code, stdout, stderr } = await runYtDlp(['-J', '--flat-playlist', `ytsearch1:${query}`]);
  const entry = code === 0 ? parseJson(stdout)?.entries?.[0] : null;
  if (code !== 0) throw new Error(`Não consegui buscar: ${describeYtDlpError(stderr)}`);
  if (!entry) throw new Error(`Não achei nada pra "${query}".`);

  return {
    tracks: [{
      title: entry.title,
      url: entry.url,
      pageUrl: entry.url,
      source: 'ytdlp',
      durationSec: entry.duration,
      requestedBy,
    }],
  };
}

/**
 * Transforma o que a pessoa digitou (link ou nome) em músicas pra fila.
 * @returns {Promise<{ name?: string, tracks: Track[] }>} `name` só vem quando é playlist/álbum.
 */
async function resolveQuery(input, requestedBy) {
  const text = input.trim();
  if (isSpotifyUrl(text)) return resolveSpotify(text, requestedBy);
  if (/^https?:\/\//i.test(text)) return resolveUrl(text, requestedBy);
  return resolveSearch(text, requestedBy);
}

module.exports = { resolveQuery };
