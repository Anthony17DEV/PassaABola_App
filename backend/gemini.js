const { ApiError, BASE_INSTRUCTIONS } = require('./domain');
// REST oficial: dispensa o SDK legado @google/generative-ai.
async function generateJSON(prompt, schema, signal, fetchImpl = fetch) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  if (!apiKey || apiKey.startsWith('COLOQUE_')) throw new ApiError(503, 'NOT_CONFIGURED', 'A geração ainda não foi configurada no servidor.');
  if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw new ApiError(503, 'INVALID_MODEL', 'Confira o modelo configurado no servidor.');
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: BASE_INSTRUCTIONS }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 6000, temperature: 0.9 },
    }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new ApiError(429, 'PROVIDER_QUOTA', 'O limite do Gemini foi atingido. Aguarde e tente depois.');
    if ([400, 401, 403, 404].includes(response.status)) throw new ApiError(503, 'PROVIDER_CONFIG', 'A IA está indisponível. Confira no servidor a chave, o modelo e o acesso à API.');
    throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'O Gemini está indisponível no momento. Tente novamente.');
  }
  const payload = await response.json();
  const candidate = payload.candidates?.[0];
  if (!candidate || candidate.finishReason !== 'STOP') throw new ApiError(502, 'INCOMPLETE_GENERATION', 'A geração não foi concluída. Tente novamente.');
  const text = (candidate.content?.parts || []).filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
  try { return JSON.parse(text); }
  catch { throw new ApiError(502, 'INVALID_JSON', 'A IA devolveu uma resposta inválida. Tente novamente.'); }
}
module.exports = { generateJSON };
