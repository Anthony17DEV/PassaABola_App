const { randomUUID } = require('node:crypto');
const { ApiError, normalize, requireText, recommendationSchema } = require('./domain');
const { generateJSON } = require('./gemini');
function safeUrl(value, hosts) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && hosts.includes(u.hostname) ? u.href : null; }
  catch { return null; }
}
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
    result = { title: found.trackName, creator: found.artistName, source: 'Apple / iTunes', url };
  } else if (item.type === 'serie') {
    const data = await getJSON(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`, signal, fetchImpl);
    const found = data.find(r => sameTitle(r.show?.name) && Number(r.show?.premiered?.slice(0, 4)) === item.year)?.show;
    if (!found) return null;
    const url = safeUrl(found.url, ['www.tvmaze.com', 'tvmaze.com']);
    if (!url) return null;
    result = { title: found.name, creator: '', source: 'TVmaze (CC BY-SA)', url };
  } else if (item.type === 'video') {
    // Nunca busca URLs arbitrárias fornecidas pelo modelo: somente IDs do YouTube.
    if (typeof item.videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(item.videoId)) return null;
    const url = `https://www.youtube.com/watch?v=${item.videoId}`;
    const data = await getJSON(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, signal, fetchImpl);
    if (!sameTitle(data.title) || normalize(data.author_name || '') !== normalize(creator)) return null;
    result = { title: data.title, creator: data.author_name, source: 'YouTube', url };
  } else return null;
  return { id: randomUUID(), type: item.type, ...result, reason };
}
async function createRecommendations(input, signal, deps = {}) {
  const generate = deps.generate || generateJSON;
  const verify = deps.verify || verifyCandidate;
  const raw = await generate(`Sugira 5 obras REAIS para curtir individualmente, conforme a configuração abaixo.
Use título exato do catálogo (preferencialmente original), artista/diretor ou canal exato, ano de lançamento e motivo curto da indicação, sem spoiler.
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
module.exports = { safeUrl, verifyCandidate, createRecommendations };
