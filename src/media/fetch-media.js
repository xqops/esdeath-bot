const fs = require('node:fs');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (compatible; EsdeathBot/1.0)';

function findMetaContent(html, property) {
  const tags = html.match(/<meta[^>]+>/gi) ?? [];
  for (const tag of tags) {
    if (!new RegExp(`(property|name)=["']${property}["']`, 'i').test(tag)) continue;
    const content = tag.match(/content=["']([^"']+)["']/i);
    if (content) return content[1].replace(/&amp;/g, '&');
  }
  return null;
}

/**
 * Baixa a mídia de um link. Se o link for uma página (Tenor, Giphy...),
 * pega o vídeo/gif real pelas meta tags og:video / og:image.
 */
async function downloadMedia(url, destPath, maxBytes = DEFAULT_MAX_BYTES) {
  const tooBig = () => new Error(`Esse arquivo é grande demais (máx. ${Math.round(maxBytes / 1024 / 1024)} MB).`);

  let response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Não consegui baixar o link (HTTP ${response.status}).`);

  if ((response.headers.get('content-type') ?? '').includes('text/html')) {
    const html = await response.text();
    const mediaUrl = findMetaContent(html, 'og:video')
      ?? findMetaContent(html, 'og:video:url')
      ?? findMetaContent(html, 'og:image');
    if (!mediaUrl) throw new Error('Esse link não tem nenhum gif que eu consiga achar.');

    response = await fetch(new URL(mediaUrl, url), { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`Não consegui baixar o gif (HTTP ${response.status}).`);
  }

  const type = response.headers.get('content-type') ?? '';
  if (!/^(image|video|audio)\//.test(type) && !type.includes('octet-stream')) {
    throw new Error('Isso não parece ser um gif, vídeo ou áudio.');
  }

  const size = Number(response.headers.get('content-length') ?? 0);
  if (size > maxBytes) throw tooBig();

  // Grava direto no disco aos poucos (arquivo grande não ocupa a memória toda).
  let received = 0;
  const limit = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      callback(received > maxBytes ? tooBig() : null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), limit, fs.createWriteStream(destPath));
}

module.exports = { downloadMedia };
