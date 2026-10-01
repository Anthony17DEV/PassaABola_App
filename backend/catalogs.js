const { randomUUID } = require('node:crypto');
const { ApiError, recommendationSchema } = require('./domain');
const { generateJSON } = require('./gemini');

// Busca a capa rapidinho. Se a API de capa falhar, retorna null e não bloqueia a sugestão da IA!
async function tryGetImage(title, type, fetchImpl = fetch) {
	try {
		const c = new AbortController();
		const t = setTimeout(() => c.abort(), 2000);

		if (type === 'serie') {
			const r = await fetchImpl(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`, { signal: c.signal });
			clearTimeout(t);
			const data = await r.json();
			return data[0]?.show?.image?.original || data[0]?.show?.image?.medium || null;
		} else {
			const r = await fetchImpl(`https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=${type === 'musica' ? 'song' : 'movie'}&limit=1`, { signal: c.signal });
			clearTimeout(t);
			const data = await r.json();
			const url = data.results?.[0]?.artworkUrl100;
			return url ? url.replace('100x100bb', '600x600bb') : null;
		}
	} catch {
		return null; // Se a capa não existir, azar. A recomendação continua viva.
	}
}

async function createRecommendations(input, signal, deps = {}) {
	const generate = deps.generate || generateJSON;
	const seed = Math.floor(Math.random() * 999999); // Impede a IA de ficar repetindo a mesma coisa

	const prompt = `Atue como um curador genial. Sugira até 3 obras REAIS (filme, série, música ou vídeo) perfeitas para a vibe do usuário.
Fuja do óbvio.
[Semente de aleatoriedade: ${seed}]
CRÍTICO:
1. No campo 'reason', explique o motivo e DIGA ONDE ASSISTIR/OUVIR (Ex: "Onde achar: Netflix" ou "Onde ouvir: Spotify").
2. No campo 'synopsis', faça uma sinopse bem escrita sobre o que é a obra.
Se format for diferente de surpresa, retorne APENAS esse tipo.
Configuração: ${JSON.stringify(input)}`;

	const raw = await generate(prompt, recommendationSchema, signal);

	if (!Array.isArray(raw) || raw.length === 0) {
		throw new ApiError(502, 'INVALID_GENERATION', 'Não foi possível gerar. Tente novamente.');
	}

	// Mapeia e aceita TUDO que a IA falar. Foda-se os catálogos limitados.
	const items = await Promise.all(raw.slice(0, 3).map(async (item) => {
		const type = input.format !== 'surpresa' ? input.format : item.type;
		const queryTerm = type === 'musica' ? `${item.title} ${item.creator}` : item.title;

		return {
			id: randomUUID(),
			type: type,
			title: item.title,
			creator: item.creator || 'Autor desconhecido',
			source: 'Sugestão da IA',
			// Joga pro Google e o cara se resolve na hora
			url: `https://www.google.com/search?q=${encodeURIComponent(queryTerm + (type === 'filme' || type === 'serie' ? ' onde assistir' : ''))}`,
			artworkUrl: await tryGetImage(item.title, type, deps.fetch),
			synopsis: item.synopsis || 'Sem sinopse disponível.',
			synopsisLabel: 'SOBRE A OBRA',
			year: item.year || new Date().getFullYear(),
			durationMinutes: null,
			genres: []
		};
	}));

	return { source: 'gemini', items };
}

// Exportações que o server.js precisa
module.exports = { createRecommendations };