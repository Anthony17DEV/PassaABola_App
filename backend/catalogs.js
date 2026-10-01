const { randomUUID } = require('node:crypto');
const { ApiError, recommendationSchema } = require('./domain');
const { generateJSON } = require('./gemini');

async function createRecommendations(input, signal, deps = {}) {
	const generate = deps.generate || generateJSON;
	const seed = Math.floor(Math.random() * 999999);

	const prompt = `Atue como um curador genial. Sugira até 3 obras REAIS (filme, série, música ou vídeo) perfeitas para a vibe do usuário.
[Semente: ${seed}]
CRÍTICO: 
1. O campo 'type' SÓ PODE SER: filme, serie, musica ou video. NUNCA escreva "surpresa".
2. No 'reason', explique o motivo e DIGA ONDE ACHAR (Ex: Netflix, Spotify).
3. No 'synopsis', resuma a obra com humor e criatividade.
Configuração: ${JSON.stringify(input)}`;

	const raw = await generate(prompt, recommendationSchema, signal);

	if (!Array.isArray(raw) || raw.length === 0) {
		throw new ApiError(502, 'INVALID_GENERATION', 'A IA não conseguiu formar as recomendações. Tente novamente.');
	}

	// Mapeia a resposta da IA e gera o link do Google instantaneamente. 
	// Removida a busca de imagem para o servidor responder na velocidade da luz sem dar Timeout.
	const items = raw.slice(0, 3).map((item) => {
		// Garante que o tipo não fuja do controle e quebre o layout
		const tipoSeguro = ['filme', 'serie', 'musica', 'video'].includes(item.type) ? item.type : 'filme';
		const queryTerm = tipoSeguro === 'musica' ? `${item.title} ${item.creator}` : item.title;

		return {
			id: randomUUID(),
			type: tipoSeguro,
			title: item.title || 'Título Desconhecido',
			creator: item.creator || 'Autor Desconhecido',
			source: 'Sugestão da IA',
			url: `https://www.google.com/search?q=${encodeURIComponent(queryTerm + (tipoSeguro === 'filme' || tipoSeguro === 'serie' ? ' onde assistir' : ''))}`,
			artworkUrl: null, // O frontend vai exibir automaticamente o ícone de fallback bonito do app
			synopsis: item.synopsis || 'Sinopse não detalhada pela IA.',
			synopsisLabel: 'SOBRE A OBRA',
			year: item.year || new Date().getFullYear(),
			durationMinutes: null,
			genres: []
		};
	});

	return { source: 'gemini', items };
}

module.exports = { createRecommendations };