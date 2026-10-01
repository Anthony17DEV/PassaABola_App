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
		if (u.hostname.endsWith('.mzstatic.com') || u.hostname.endsWith('.itunes.apple.com') || u.hostname.includes('tmdb.org') || u.hostname.includes('ytimg.com')) {
			u.protocol = 'https:';
			return u.href;
		}
		return null;
	} catch { return null; }
}

function cleanText(value, max = 900) {
	if (typeof value !== 'string') return null;
	const plain = value.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
		.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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
	const sameTitle = t => typeof t === 'string' && normalize(t).includes(normalize(title));
	let result;

	if (['filme', 'serie', 'documentario'].includes(item.type)) {
		const tmdbKey = process.env.TMDB_API_KEY;
		if (!tmdbKey) throw new Error('TMDB API Key ausente. Configure no painel do Render.');

		const searchUrl = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&language=pt-BR&api_key=${tmdbKey}`;
		const data = await getJSON(searchUrl, signal, fetchImpl);

		let found = data.results?.find(r => (r.media_type === 'movie' || r.media_type === 'tv') && sameTitle(r.title || r.name));
		if (!found && data.results?.length > 0) {
			const first = data.results[0];
			if (first.media_type === 'movie' || first.media_type === 'tv') found = first;
		}

		if (!found) return null;

		const mediaType = found.media_type;
		const id = found.id;

		const provUrl = `https://api.themoviedb.org/3/${mediaType}/${id}/watch/providers?api_key=${tmdbKey}`;
		const provData = await getJSON(provUrl, signal, fetchImpl);
		const brProviders = provData.results?.BR?.flatrate || [];

		const providers = brProviders.map(p => ({
			name: p.provider_name,
			logo: p.logo_path ? `https://image.tmdb.org/t/p/w200${p.logo_path}` : null
		})).filter(p => p.logo).slice(0, 4);

		result = {
			title: found.title || found.name,
			creator,
			source: 'TMDB / JustWatch',
			url: `https://www.themoviedb.org/${mediaType}/${id}`,
			artworkUrl: found.poster_path ? `https://image.tmdb.org/t/p/w500${found.poster_path}` : null,
			synopsis: cleanText(found.overview),
			synopsisLabel: 'Sinopse',
			year: yearOf(found.release_date || found.first_air_date),
			durationMinutes: null,
			genres: [],
			providers
		};
	} else if (item.type === 'musica') {
		const query = new URLSearchParams({ term: `${title} ${creator}`, country: 'BR', entity: 'song', limit: '10' });
		const data = await getJSON(`https://itunes.apple.com/search?${query}`, signal, fetchImpl);
		const found = data.results?.find(r => sameTitle(r.trackName) && normalize(r.artistName || '') === normalize(creator));
		if (!found) return null;
		const url = safeUrl(found.trackViewUrl, ['music.apple.com', 'itunes.apple.com']);
		if (!url) return null;
		const year = yearOf(found.releaseDate);
		result = {
			title: found.trackName, creator: found.artistName, source: 'Apple Music', url,
			artworkUrl: artworkUrl(found.artworkUrl100 || found.artworkUrl60),
			synopsis: [found.collectionName && `Álbum: ${found.collectionName}`, year && `Ano: ${year}`].filter(Boolean).join(' • '),
			synopsisLabel: 'Sobre a faixa', year, durationMinutes: minutes(found.trackTimeMillis), genres: [], providers: []
		};
	} else if (item.type === 'video') {
		if (typeof item.videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(item.videoId)) return null;
		const url = `https://www.youtube.com/watch?v=${item.videoId}`;
		const data = await getJSON(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, signal, fetchImpl);
		if (!data.title) return null;
		result = {
			title: data.title, creator: data.author_name, source: 'YouTube', url,
			artworkUrl: artworkUrl(data.thumbnail_url), synopsis: `Vídeo do canal ${data.author_name}.`,
			synopsisLabel: 'Sobre o vídeo', year: null, durationMinutes: null, genres: [], providers: []
		};
	} else return null;

	return { id: randomUUID(), type: item.type, ...result, reason };
}

async function createRecommendations(input, signal, deps = {}) {
	const generate = deps.generate || generateJSON;
	const verify = deps.verify || verifyCandidate;

	const seed = Math.floor(Math.random() * 999999);

	const raw = await generate(`Sugira 5 obras REAIS para curtir individualmente, conforme a configuração abaixo.
O estilo, interesses e assuntos a evitar são obrigatórios. Fuja do óbvio, não sugira os mesmos clássicos batidos.
[Variável de aleatoriedade: ${seed}]
Se format for diferente de surpresa, retorne APENAS esse tipo. Configuração: ${JSON.stringify(input)}`, recommendationSchema, signal);

	if (!Array.isArray(raw) || raw.length < 1) throw new ApiError(502, 'INVALID_GENERATION', 'Não foi possível criar as sugestões. Tente novamente.');

	const results = [];

	for (let i = 0; i < raw.length && results.length < 1; i += 2) {
		const batch = await Promise.allSettled(raw.slice(i, i + 2).map(async item => {
			if (!item) return null;
			if (input.format !== 'surpresa') {
				item.type = input.format;
			}
			return verify(item, signal);
		}));
		if (signal.aborted) throw signal.reason;
		for (const r of batch) {
			if (r.status === 'fulfilled' && r.value) results.push(r.value);
		}
	}
	if (!results.length) throw new ApiError(502, 'NO_VERIFIED_RESULTS', 'Não conseguimos confirmar essas sugestões nos catálogos.');

	return { source: 'gemini', items: results.slice(0, 1) };
}

module.exports = { safeUrl, artworkUrl, cleanText, verifyCandidate, createRecommendations };