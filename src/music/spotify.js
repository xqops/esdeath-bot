// O Spotify não deixa bots tocarem o áudio dele. Aqui só lemos os nomes das músicas
// (pela página de "embed", que é pública) pra depois procurar cada uma no YouTube.
const SPOTIFY_URL = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist)\/([A-Za-z0-9]+)/;

function isSpotifyUrl(text) {
  return SPOTIFY_URL.test(text);
}

/**
 * @returns {Promise<{ name: string, tracks: { title: string, artists: string, durationMs: number }[] }>}
 */
async function getSpotifyTracks(url) {
  const [, kind, id] = url.match(SPOTIFY_URL);
  const response = await fetch(`https://open.spotify.com/embed/${kind}/${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!response.ok) throw new Error(`Não consegui abrir o link do Spotify (HTTP ${response.status}).`);

  const html = await response.text();
  const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)?.[1];
  const entity = json && JSON.parse(json).props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Não consegui ler esse link do Spotify. A playlist é pública?');

  if (kind === 'track') {
    return {
      name: entity.name,
      tracks: [{
        title: entity.name,
        artists: (entity.artists ?? []).map((artist) => artist.name).join(', '),
        durationMs: entity.duration,
      }],
    };
  }

  // Álbum e playlist: a página mostra até 100 músicas.
  return {
    name: entity.name ?? entity.title,
    tracks: (entity.trackList ?? []).map((track) => ({
      title: track.title,
      artists: track.subtitle ?? '',
      durationMs: track.duration,
    })),
  };
}

module.exports = { isSpotifyUrl, getSpotifyTracks };
