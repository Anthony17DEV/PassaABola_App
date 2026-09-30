const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { validateInput, validateCards } = require('../domain');
const { generateJSON } = require('../gemini');
const { verifyCandidate, createRecommendations, safeUrl } = require('../catalogs');
const input = { mode: 'brisa-solo', mood: 'Dar risada', topics: ['Espaço'], exclude: [] };
const cards = () => Array.from({ length: 5 }, (_, i) => ({ topic: 'Espaço', question: `Pergunta criativa ${i}?`, followUp: 'Pense em outra possibilidade.', groupFollowUp: 'A roda comenta a ideia.' }));
async function serve(t, deps) {
  const server = createApp(deps).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, post: (data, path = '/api/gerar-cartas') => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) };
}
test('valida modo, mood e temas antes do provedor', async t => {
  let called = 0;
  const { post } = await serve(t, { generate: async () => { called++; return cards(); } });
  for (const change of [{ mode: 'invalido' }, { mood: '' }, { topics: 'foo' }, { topics: [{}] }]) assert.equal((await post({ ...input, ...change })).status, 400);
  assert.equal(called, 0);
});
test('contrato saudável: health e cinco cartas com IDs do servidor', async t => {
  const { base, post } = await serve(t, { generate: async () => cards() });
  assert.equal((await (await fetch(base + '/health')).json()).ok, true);
  const r = await post(input); assert.equal(r.status, 200);
  const body = await r.json(); assert.equal(body.source, 'gemini'); assert.equal(body.cards.length, 5);
  assert.equal(new Set(body.cards.map(c => c.id)).size, 5);
});
test('desafios geram tipo challenge', () => {
  const result = validateCards(cards(), { ...input, mode: 'desafios-solo' });
  assert.equal(result[0].kind, 'challenge');
});
test('rejeita lotes incompletos, duplicados, tema inválido e campo ausente', () => {
  assert.throws(() => validateCards([], input));
  const duplicate = cards(); duplicate[1].question = duplicate[0].question;
  assert.throws(() => validateCards(duplicate, input));
  const other = cards(); other[1].topic = 'Games'; assert.throws(() => validateCards(other, input));
  const missing = cards(); delete missing[1].followUp; assert.throws(() => validateCards(missing, input));
  assert.throws(() => validateCards(cards(), { ...input, exclude: ['Pergunta criativa 0?'] }));
});
test('limite de IP devolve 429 sem nova chamada', async t => {
  let calls = 0; const { post } = await serve(t, { generate: async () => { calls++; return cards(); } });
  for (let i = 0; i < 6; i++) assert.equal((await post(input)).status, 200);
  assert.equal((await post(input)).status, 429); assert.equal(calls, 6);
});
test('falha do provedor não retorna perguntas locais nem erro sensível', async t => {
  const { post } = await serve(t, { generate: async () => { throw new Error('SENSITIVE_SECRET'); } });
  const r = await post(input); assert.equal(r.status, 500);
  assert.ok(!(await r.text()).includes('SENSITIVE_SECRET'));
});
test('JSON malformado retorna 400', async t => {
  const { base } = await serve(t, {});
  const r = await fetch(base + '/api/gerar-cartas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(r.status, 400);
});
test('REST envia schema e chave no header, não na URL', async () => {
  const old = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'test-only';
  try {
    const result = await generateJSON('teste', { type: 'ARRAY' }, new AbortController().signal, async (url, init) => {
      assert.ok(!url.includes('test-only'));
      assert.equal(init.headers['x-goog-api-key'], 'test-only');
      assert.equal(JSON.parse(init.body).generationConfig.responseMimeType, 'application/json');
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '[]' }] } }] }));
    });
    assert.deepEqual(result, []);
  } finally { if (old === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = old; }
});
test('quota do Gemini mapeia para erro 429', async () => {
  const old = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'test-only';
  try { await assert.rejects(() => generateJSON('x', {}, new AbortController().signal, async () => new Response('{}', { status: 429 })), e => e.status === 429); }
  finally { if (old === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = old; }
});
test('links de recomendação não aceitam hosts arbitrários', () => {
  assert.equal(safeUrl('https://evil.test/a', ['www.youtube.com']), null);
  assert.equal(safeUrl('javascript:alert(1)', ['www.youtube.com']), null);
  assert.equal(safeUrl('https://user:pass@www.youtube.com/a', ['www.youtube.com']), null);
});
test('música só entra com título e artista conferidos no catálogo', async () => {
  const item = { type: 'musica', title: 'Example', creator: 'Artist', reason: 'Combina com o clima.' };
  const mock = async () => new Response(JSON.stringify({ results: [{ trackName: 'Example', artistName: 'Artist', trackViewUrl: 'https://music.apple.com/br/album/example/123' }] }));
  const result = await verifyCandidate(item, new AbortController().signal, mock);
  assert.equal(result.title, 'Example'); assert.equal(result.source, 'Apple / iTunes');
  assert.equal(await verifyCandidate({ ...item, creator: 'Other' }, new AbortController().signal, mock), null);
});
test('vídeo inválido não causa fetch a host arbitrário', async () => {
  let called = false;
  const result = await verifyCandidate({ type: 'video', title: 'a', creator: 'b', reason: 'c', videoId: 'https://127.0.0.1' }, new AbortController().signal, async () => { called = true; });
  assert.equal(result, null); assert.equal(called, false);
});
test('nenhuma recomendação confirmada é erro explícito', async () => {
  const config = validateInput({ ...input, mode: 'recomendacoes', format: 'musica' }, true);
  await assert.rejects(() => createRecommendations(config, new AbortController().signal, {
    generate: async () => Array.from({ length: 5 }, () => ({ type: 'musica' })), verify: async () => null,
  }), e => e.code === 'NO_VERIFIED_RESULTS');
});


test('aceita temas e estilos livres sem criar endpoints arbitrários', () => {
  const config = validateInput({ ...input, mood: 'Humor ácido', topics: ['Vida de programador', 'Anime'], style: 'Debates absurdos', interests: 'Naruto, bugs de produção e rap.', avoid: 'Spoilers' });
  assert.equal(config.style, 'Debates absurdos');
  assert.equal(config.topics[0], 'Vida de programador');
  assert.throws(() => validateInput({ ...input, mode: 'meu-endpoint' }));
});
test('rejeita texto livre grande e listas acima do limite', () => {
  for (const extra of [{ mood: 'a'.repeat(61) }, { style: 'a'.repeat(101) }, { interests: 'a'.repeat(601) }, { avoid: 'a'.repeat(301) }, { topics: Array(11).fill('teste') }]) assert.throws(() => validateInput({ ...input, ...extra }));
});
test('carta personalizada mantém rótulo do tema solicitado', () => {
  const custom = cards().map(c => ({ ...c, topic: 'Vida de programador' }));
  assert.equal(validateCards(custom, { ...input, topics: ['Vida de programador'] })[0].topic, 'Vida de programador');
});
test('prompt inclui contexto e orienta humor adulto específico', () => {
  const { cardPrompt, BASE_INSTRUCTIONS } = require('../domain');
  const prompt = cardPrompt({ ...input, mode: 'desafios-solo', style: 'Rimas', interests: 'rap nacional', avoid: 'spoilers' });
  assert.ok(prompt.includes('rap nacional') && prompt.includes('Rimas') && prompt.includes('spoilers'));
  assert.ok(prompt.includes('desafios SOLO') && BASE_INSTRUCTIONS.includes('sem tratar o público como criança'));
});
test('capas só aceitam domínios conhecidos e descrição remove HTML', () => {
  const { artworkUrl, cleanText } = require('../catalogs');
  assert.equal(artworkUrl('https://evil.test/poster.jpg'), null);
  assert.equal(artworkUrl('https://static.tvmaze.com.evil.test/poster.jpg'), null);
  assert.equal(artworkUrl('https://is1-ssl.mzstatic.com/image.jpg'), 'https://is1-ssl.mzstatic.com/image.jpg');
  assert.equal(cleanText('<p>Uma <b>história</b> &amp; outra.</p><script>x()</script>'), 'Uma história & outra.');
});
test('metadados de filme incluem sinopse e capa da fonte', async () => {
  const mock = async () => new Response(JSON.stringify({ results: [{ trackName: 'Example', artistName: 'Director', releaseDate: '2020-01-01', trackViewUrl: 'https://tv.apple.com/br/movie/example/123', artworkUrl100: 'https://is1-ssl.mzstatic.com/image.jpg', longDescription: '<p>Uma sinopse real do catálogo.</p>', trackTimeMillis: 5400000, primaryGenreName: 'Comedy' }] }));
  const result = await verifyCandidate({ type: 'filme', title: 'Example', creator: 'Director', year: 2020, reason: 'Combina.' }, new AbortController().signal, mock);
  assert.equal(result.synopsis, 'Uma sinopse real do catálogo.');
  assert.equal(result.durationMinutes, 90); assert.equal(result.year, 2020); assert.ok(result.artworkUrl);
});
test('música usa dados de álbum e gênero, não inventa sinopse', async () => {
  const mock = async () => new Response(JSON.stringify({ results: [{ trackName: 'Example', artistName: 'Artist', collectionName: 'Album', primaryGenreName: 'Hip-Hop', trackViewUrl: 'https://music.apple.com/br/album/example/123' }] }));
  const r = await verifyCandidate({ type: 'musica', title: 'Example', creator: 'Artist', reason: 'Combina.' }, new AbortController().signal, mock);
  assert.equal(r.synopsisLabel, 'Sobre a faixa'); assert.ok(r.synopsis.includes('Album')); assert.equal(r.artworkUrl, null);
});
test('série preserva atribuição e dados verificados', async () => {
  const mock = async () => new Response(JSON.stringify([{ show: { name: 'Example', premiered: '2020-01-01', url: 'https://www.tvmaze.com/shows/123/example', summary: '<p>Uma comédia.</p>', image: { original: 'https://static.tvmaze.com/image.jpg' }, averageRuntime: 25, genres: ['Comedy'] } }]));
  const r = await verifyCandidate({ type: 'serie', title: 'Example', creator: 'Channel', year: 2020, reason: 'Combina.' }, new AbortController().signal, mock);
  assert.equal(r.source, 'TVmaze (CC BY-SA)'); assert.equal(r.synopsis, 'Uma comédia.'); assert.equal(r.durationMinutes, 25);
});
