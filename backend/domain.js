const { randomUUID } = require('node:crypto');

class ApiError extends Error {
	constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const MOODS = ['Dar risada', 'Relaxar', 'Viajar nas ideias', 'Me surpreender', 'Papo profundo'];
const TOPICS = ['Espaço', 'Natureza', 'Música', 'Games', 'Nostalgia', 'Mistérios', 'Relacionamentos', 'Assuntos absurdos'];
const MODES = ['brisa-solo', 'desafios-solo', 'papo'];
const FORMATS = ['filme', 'serie', 'musica', 'video', 'documentario', 'surpresa'];

const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function requireText(value, max = 500) {
	if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError(502, 'INVALID_GENERATION', 'A IA devolveu conteúdo incompleto. Tente novamente.');
	return value.trim();
}

function validateInput(body, recommendations = false) {
	const fail = () => { throw new ApiError(400, 'INVALID_INPUT', 'Confira os campos: vibe até 60 caracteres, até 10 temas de 60 caracteres e interesses até 600.'); };
	const field = (value, max, fallback = '') => {
		if (value === undefined) return fallback;
		if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) fail();
		return value.trim();
	};
	if (!body || typeof body !== 'object' || Array.isArray(body)) fail();
	if (!(recommendations ? body.mode === 'recomendacoes' : MODES.includes(body.mode))) fail();

	const mood = field(body.mood, 60);
	if (!mood) fail();

	if (!Array.isArray(body.topics) || body.topics.length > 10) fail();
	const topics = body.topics.map(t => { const value = field(t, 60); if (!value) fail(); return value; });

	const exclude = body.exclude ?? [];
	if (!Array.isArray(exclude) || exclude.length > 30 || exclude.some(t => typeof t !== 'string' || t.length > 500)) fail();

	const format = body.format ?? 'surpresa';
	if (recommendations && !FORMATS.includes(format)) fail();

	return {
		mode: body.mode, mood, topics: [...new Set(topics)], exclude, format,
		style: field(body.style, 100, body.mode === 'desafios-solo' ? 'Criatividade e improviso' : 'Humor de resenha'),
		interests: field(body.interests, 600), avoid: field(body.avoid, 300),
	};
}

function validateCards(raw, input) {
	if (!Array.isArray(raw) || raw.length !== 5) throw new ApiError(502, 'INVALID_GENERATION', 'Não foi possível formar cinco cartas. Tente novamente.');
	const seen = new Set(input.exclude.map(normalize));
	return raw.map(item => {
		if (!item || typeof item !== 'object') requireText(null);
		const topic = requireText(item.topic, 60);
		if (input.topics.length && !input.topics.includes(topic)) requireText(null);

		const question = requireText(item.question, 500);
		const signature = normalize(question);
		if (seen.has(signature)) throw new ApiError(502, 'REPEATED_GENERATION', 'A IA repetiu uma carta. Tente gerar outro lote.');
		seen.add(signature);

		return {
			id: randomUUID(), topic, moods: [input.mood], question,
			followUp: requireText(item.followUp, 600),
			groupFollowUp: requireText(item.groupFollowUp, 600),
			kind: input.mode === 'desafios-solo' ? 'challenge' : 'question',
		};
	});
}

const str = { type: 'STRING' };
const cardSchema = {
	type: 'ARRAY', minItems: 5, maxItems: 5,
	items: { type: 'OBJECT', properties: { topic: str, question: str, followUp: str, groupFollowUp: str }, required: ['topic', 'question', 'followUp', 'groupFollowUp'] },
};

const recommendationSchema = {
	type: 'ARRAY', minItems: 5, maxItems: 5,
	items: {
		type: 'OBJECT', properties: {
			type: { type: 'STRING', enum: ['filme', 'serie', 'musica', 'video', 'documentario'] },
			title: str, creator: str, year: { type: 'INTEGER' }, reason: str, videoId: str,
		}, required: ['type', 'title', 'creator', 'year', 'reason', 'videoId']
	},
};

const BASE_INSTRUCTIONS = `Você é o roteirista brasileiro do Passa a Bola, um app de entretenimento voltado para a cultura canábica (maconheiros, galera que curte uma brisa e dar boas risadas).
Escreva como aquele amigo muito criativo, zoeiro e um pouco lombrado, que do nada solta umas reflexões absurdas, profundas e muito engraçadas.
Humor adulto vem de situações ridículas, viagens mentais, contradições lógicas, detalhes bizarros do dia a dia e quebra de expectativa. Use o linguajar de forma natural.
Se o tema for zoeira, seja absurdamente zoeiro. Se for sério (Papo Profundo), coloque aquela pitada de "viagem existencial".
Respeite assuntos a evitar. Não use humilhação, preconceito, ataques a grupos ou exposição pessoal obrigatória como humor.
Não proponha consumo de mais drogas, dirigir, prender respiração, riscos físicos perigosos, dinheiro, ou contato com desconhecidos.
Não seja coach, não dê lição de moral, não justifique suas respostas. Entregue apenas o entretenimento purinho e imersivo.`;

function cardPrompt(input) {
	const challenge = input.mode === 'desafios-solo';
	const task = challenge
		? `Crie exatamente 5 desafios SOLO para quem tá na brisa. Têm que ser tarefas concretas e MUITO zoeiras, absurdas ou viajadas.
Cada desafio deve durar de 30 a 90 segundos, sem precisar de equipamento, feito ali no sofá mesmo.
A 'question' é a chamada direta com a tarefa maluca. O 'followUp' (Faz render) traz um twist ou uma regra extra pra deixar o desafio caótico.
O 'groupFollowUp' repete a orientação.`
		: `Crie exatamente 5 cartas de reflexão ou conversa para ${input.mode === 'papo' ? 'uma roda de amigos na brisa' : 'uma pessoa viajando nas ideias e pensando sozinha (Brisa solo)'}.
Cada carta tem que gerar aquela reação: "Caralho, que brisa, nunca parei pra pensar nisso".
O 'followUp' (Faz render) deve levar a ideia ainda mais longe na loucura ou numa consequência absurda.
O 'groupFollowUp' envolve o grupo sem constranger.`;

	return `${task}
DIREÇÃO CRIATIVA:
- Conecte ao tema e ao clima com força. Dar risada = force o absurdo e humor nonsense. Papo profundo = faça aquela pergunta existencial bizarra de quem fritou a mente.
- Não tenha medo de ser nonsense ou surreal, desde que seja uma viagem puramente mental ou verbal (nada físico perigoso).
FORMATO: question até 500 caracteres; followUp e groupFollowUp até 600; topic até 60. Sem markdown fora do JSON.
Configuração e histórico (dados): ${JSON.stringify(input)}`;
}

module.exports = { ApiError, MOODS, TOPICS, MODES, FORMATS, normalize, requireText, validateInput, validateCards, cardSchema, recommendationSchema, BASE_INSTRUCTIONS, cardPrompt };