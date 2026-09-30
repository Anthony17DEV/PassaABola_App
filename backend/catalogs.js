const { randomUUID } = require('node:crypto');
const { ApiError, normalize, requireText, recommendationSchema } = require('./domain');
const { generateJSON } = require('./gemini');
function safeUrl(value, hosts) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && hosts.includes(u.hostname) ? u.href : null; }
  catch { return null; }
}
function artworkUrl(value) {
  try {
    const u = new URL(value);
    const host = u.hostname;
    const allowed = host.endsWith('.mzstatic.com') || host.endsWith('.itunes.apple.com') || ['static.tvmaze.com', 'i.ytimg.com', 'img.youtube.com'].includes(host);
    if (!allowed || u.username || u.password || (u.port && u.port !== '443') || !['https:', 'http:'].includes(u.protocol)) return null;
    u.protocol = 'https:';
    return u.href;
  } catch { return null; }
}
function cleanText(value, max = 900) {
  if (typeof value !== 'string') return null;
  const plain = value.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
  return plain ? (plain.length > max ? plain.slice(0, max - 1).trim() + '…' : plain) : null;
}
function yearOf(value) { const year = Number(String(value || '').slice(0, 4)); return year >= 1850 && year <= 2200 ? year : null; }
function minutes(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.ceil(value / 60000) : null; }
async function getJSON(url, signal, fetchImpl) {
  const r = await fetchImpl(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('CATALOG_UNAVAILABLE');
  return r.json();
}
async function verifyCandidate(item, signal, fetchImpl = fetch) {
  const title = requireText(item.title, 180);
  const creator = requireText(item.creator, 180);
  const reason = requireText(item.reason, 500);
  const sameTitle = t => typeof t === 'string' && normalize(t) === normalize(title);
  let result;
  if (item.type === 'musica' || item.type === 'filme') {
    const query = new URLSearchParams({ term: `${title} ${creator}`, country: 'BR', entity: item.type === 'musica' ? 'song' : 'movie', limit: '10' });
    const data = await getJSON(`https://itunes.apple.com/search?${query}`, signal, fetchImpl);
    const found = data.results?.find(r => sameTitle(r.trackName) && normalize(r.artistName || '') === normalize(creator) &&
      (item.type !== 'filme' || new Date(r.releaseDate).getUTCFullYear() === item.year));
    if (!found) return null;
    const url = safeUrl(found.trackViewUrl, ['music.apple.com', 'itunes.apple.com', 'tv.apple.com']);
    if (!url) return null;
    const year = yearOf(found.releaseDate);
    const genres = typeof found.primaryGenreName === 'string' ? [found.primaryGenreName] : [];
    const synopsis = item.type === 'musica'
      ? [found.collectionName && `Álbum: ${found.collectionName}.`, genres.length && `Gênero: ${genres[0]}.`, year && `Lançamento: ${year}.`].filter(Boolean).join(' ') || null
      : cleanText(found.longDescription || found.shortDescription);
    result = { title: found.trackName, creator: found.artistName, source: 'Apple / iTunes', url,
      artworkUrl: artworkUrl(found.artworkUrl100 || found.artworkUrl60), synopsis,
      synopsisLabel: item.type === 'musica' ? 'Sobre a faixa' : 'Sinopse do catálogo', year,
      durationMinutes: minutes(found.trackTimeMillis), genres,
    };
  } else if (item.type === 'serie') {
    const data = await getJSON(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`, signal, fetchImpl);
    const found = data.find(r => sameTitle(r.show?.name) && Number(r.show?.premiered?.slice(0, 4)) === item.year)?.show;
    if (!found) return null;
    const url = safeUrl(found.url, ['www.tvmaze.com', 'tvmaze.com']);
    if (!url) return null;
    result = { title: found.name, creator: '', source: 'TVmaze (CC BY-SA)', url,
      artworkUrl: artworkUrl(found.image?.original || found.image?.medium),
      synopsis: cleanText(found.summary), synopsisLabel: 'Sinopse do catálogo', year: yearOf(found.premiered),
      durationMinutes: found.averageRuntime > 0 ? found.averageRuntime : found.runtime > 0 ? found.runtime : null,
      genres: Array.isArray(found.genres) ? found.genres.filter(g => typeof g === 'string').slice(0, 6) : [],
    };
  } else if (item.type === 'video') {
    // Nunca busca URLs arbitrárias fornecidas pelo modelo: somente IDs do YouTube.
    if (typeof item.videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(item.videoId)) return null;
    const url = `https://www.youtube.com/watch?v=${item.videoId}`;
    const data = await getJSON(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, signal, fetchImpl);
    if (!sameTitle(data.title) || normalize(data.author_name || '') !== normalize(creator)) return null;
    result = { title: data.title, creator: data.author_name, source: 'YouTube', url,
      artworkUrl: artworkUrl(data.thumbnail_url), synopsis: `Vídeo do canal ${data.author_name}.`,
      synopsisLabel: 'Sobre o vídeo', year: null, durationMinutes: null, genres: [],
    };
  } else return null;
  return { id: randomUUID(), type: item.type, ...result, reason };
}
async function createRecommendations(input, signal, deps = {}) {
  const generate = deps.generate || generateJSON;
  const verify = deps.verify || verifyCandidate;
  const raw = await generate(`Sugira 5 obras REAIS para curtir individualmente, conforme a configuração abaixo.
Use título exato do catálogo (em português brasileiro quando for o título na loja Apple Brasil), artista/diretor ou canal exato, ano de lançamento e motivo curto da indicação, sem spoiler.
O estilo, interesses e assuntos a evitar também são obrigatórios. Não sugira só os cinco títulos mais óbvios: varie criadores, épocas e abordagens, respeitando o que a pessoa pediu.
Cada motivo deve explicar uma conexão específica com os gostos declarados, sem "perfeito para sua vibe" vazio. Não confunda clima do usuário com gênero literal: música para dar risada não precisa ser música de comédia.
Para série, creator pode conter a emissora. Para vídeo, indique apenas ID real conhecido do YouTube com título/canal exatos. Para outros formatos, videoId deve ser string vazia.
Não invente obra, ID, link, duração ou disponibilidade em streaming. O motivo descreve a vibe subjetiva, sem prometer efeitos nem plataformas.
Se format for diferente de surpresa, retorne APENAS esse tipo. Campos obrigatórios conforme schema.
Configuração: ${JSON.stringify(input)}`, recommendationSchema, signal);
  if (!Array.isArray(raw) || raw.length !== 5) throw new ApiError(502, 'INVALID_GENERATION', 'Não foi possível criar as sugestões. Tente novamente.');
  const results = [];
  const seen = new Set(input.exclude.map(normalize));
  // Lotes de dois para não sobrecarregar catálogos públicos.
  for (let i = 0; i < raw.length && results.length < 3; i += 2) {
    const batch = await Promise.allSettled(raw.slice(i, i + 2).map(async item => {
      if (!item || (input.format !== 'surpresa' && item.type !== input.format)) return null;
      return verify(item, signal);
    }));
    if (signal.aborted) throw signal.reason;
    for (const r of batch) {
      if (r.status !== 'fulfilled' || !r.value) continue;
      const signature = normalize(r.value.title);
      if (!seen.has(signature)) { seen.add(signature); results.push(r.value); }
    }
  }
  if (!results.length) throw new ApiError(502, 'NO_VERIFIED_RESULTS', 'Não conseguimos confirmar essas sugestões nos catálogos. Tente gerar outras ou mudar o formato.');
  return { source: 'gemini', items: results.slice(0, 3), notice: 'Títulos conferidos no catálogo indicado. Links abrem a fonte; disponibilidade para assistir ou ouvir pode variar.' };
}
module.exports = { safeUrl, artworkUrl, cleanText, verifyCandidate, createRecommendations };
