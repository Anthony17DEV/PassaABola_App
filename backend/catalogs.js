const { randomUUID } = require('node:crypto');
const { ApiError, recommendationSchema } = require('./domain');
const { generateJSON } = require('./gemini');

// Busca a capa e os dados reais. Mas se demorar mais de 2.5 seg, desiste pra não bugar o app!
async function tryGetCatalogData(title, type) {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 2500); // 2.5 segundos limite

		if (type === 'serie') {
			const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`, { signal: controller.signal });
			clearTimeout(timeout);
			const data = await res.json();
			const show = data[0]?.show;
			if (show) {
				return {
					artworkUrl: show.image?.original || show.image?.medium || null,
					synopsis: show.summary ? show.summary.replace(/<[^>]*>?/gm, '') : null,
					year: show.premiered ? parseInt(show.premiered.substring(0, 4)) : null,
					url: show.url
				};
			}
		} else {
			const entity = type === 'musica' ? 'song' : 'movie';
			const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=${entity}&limit=1&country=BR`, { signal: controller.signal });
			clearTimeout(timeout);
			const data = await res.json();
			const result = data.results?.[0];
			if (result) {
				return {
					artworkUrl: result.artworkUrl100 ? result.artworkUrl100.replace('100x100bb', '600x600bb') : null,
					synopsis: result.longDescription || result.shortDescription || null,
					year: result.releaseDate ? parseInt(result.releaseDate.substring(0, 4)) : null,
					url: result.trackViewUrl
				};
			}
		}
	} catch (e) {
		// Falhou ou demorou demais? Não tem problema, o Fallback assume.
		return null;
	}
	return null;
}

async function createRecommendations(input, signal, deps = {}) {
	const generate = deps.generate || generateJSON;
	const seed = Math.floor(Math.random() * 999999);

	const prompt = `Atue como um curador genial. Sugira exatamente 5 obras REAIS (filme, série, música ou vídeo) perfeitas para a vibe do usuário.
  Fuja de títulos óbvios.
  Seed: ${seed}
  Configuração: ${JSON.stringify(input)}`;

	const raw = await generate(prompt, recommendationSchema, signal);

	if (!Array.isArray(raw) || raw.length === 0) {
		throw new ApiError(502, 'INVALID_GENERATION', 'A IA não devolveu sugestões válidas.');
	}

	const results = [];

	for (const item of raw) {
		if (results.length >= 3) break; // O App só mostra as 3 melhores

		const type = ['filme', 'serie', 'musica', 'video'].includes(item.type) ? item.type : 'filme';
		const title = item.title || 'Desconhecido';
		const creator = item.creator || '';
		const reason = item.reason || 'Essa combina muito com a sua vibe.';

		// Tenta pegar a capa real
		const catalogData = await tryGetCatalogData(title, type);

		// Gera link pro Google caso o catálogo tenha falhado
		const queryTerm = type === 'musica' ? `${title} ${creator}` : title;
		const googleLink = `https://www.google.com/search?q=${encodeURIComponent(queryTerm + (type === 'filme' || type === 'serie' ? ' onde assistir' : ''))}`;

		results.push({
			id: randomUUID(),
			type: type,
			title: title,
			creator: creator,
			reason: reason,
			source: catalogData?.url ? 'Catálogo Oficial' : 'Busca Inteligente',
			url: catalogData?.url || googleLink,
			artworkUrl: catalogData?.artworkUrl || null,
			synopsis: catalogData?.synopsis || 'Nenhuma sinopse disponível na fonte.',
			synopsisLabel: 'SOBRE A OBRA',
			year: catalogData?.year || null,
			durationMinutes: null,
			genres: []
		});
	}

	if (results.length === 0) throw new ApiError(502, 'NO_VERIFIED_RESULTS', 'Erro ao processar as recomendações.');

	return { source: 'gemini', items: results };
}

module.exports = { createRecommendations };