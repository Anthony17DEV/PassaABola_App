require('dotenv').config();
(async () => {
  if (!process.env.GEMINI_API_KEY) throw new Error('Configure GEMINI_API_KEY no backend/.env.');
  let token = '';
  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '100');
    if (token) url.searchParams.set('pageToken', token);
    const response = await fetch(url, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Gemini respondeu HTTP ${response.status}. Confira chave e acesso no AI Studio.`);
    const data = await response.json();
    for (const m of data.models || []) if (m.supportedGenerationMethods?.includes('generateContent')) console.log(m.name.replace(/^models\//, ''));
    token = data.nextPageToken || '';
  } while (token);
  console.log('Estar na lista não garante cota gratuita. Confira a cota do projeto no AI Studio.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
