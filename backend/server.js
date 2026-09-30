require('dotenv').config();
const express = require('express');
const { randomUUID } = require('node:crypto');
const { ApiError, validateInput, validateCards, cardSchema, cardPrompt } = require('./domain');
const { generateJSON } = require('./gemini');
const { createRecommendations } = require('./catalogs');
function positive(name, fallback) { const value = Number(process.env[name]); return Number.isInteger(value) && value > 0 ? value : fallback; }
function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');
  const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (Number.isInteger(hops) && hops > 0) app.set('trust proxy', hops);
  app.use((req, res, next) => {
    // CORS não é autenticação. A proteção básica está nos limites abaixo.
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '24kb' }));
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'passa-a-bola-api' }));
  const users = new Map();
  let windowStarted = Date.now(), day = '', spent = 0, running = 0;
  const maxIP = positive('MAX_REQUESTS_PER_IP', 6);
  const maxDay = positive('MAX_GENERATIONS_PER_DAY', 100);
  const maxRunning = positive('MAX_CONCURRENT', 3);
  async function handle(req, res, rec) {
    const input = validateInput(req.body, rec);
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; spent = 0; }
    if (Date.now() - windowStarted >= 60000) { users.clear(); windowStarted = Date.now(); }
    const key = req.ip || 'unknown';
    const count = users.get(key) || 0;
    if (count >= maxIP || users.size >= 10000 || spent >= maxDay) {
      res.set('Retry-After', spent >= maxDay ? '3600' : '60');
      throw new ApiError(429, 'RATE_LIMIT', 'O limite de geração foi atingido. Tente mais tarde.');
    }
    if (running >= maxRunning) throw new ApiError(503, 'BUSY', 'Tem muita gente gerando agora. Aguarde um pouco.');
    users.set(key, count + 1); spent++; running++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('TIMEOUT')), 75000);
    const onClose = () => { if (!res.writableEnded) controller.abort(new Error('DISCONNECTED')); };
    res.on('close', onClose);
    try {
      if (rec) {
        const generateRecommendations = deps.recommendations || createRecommendations;
        const result = await generateRecommendations(input, controller.signal);
        if (!controller.signal.aborted) res.json(result);
      } else {
        const generate = deps.generate || generateJSON;
        const raw = await generate(cardPrompt(input), cardSchema, controller.signal);
        const cards = validateCards(raw, input);
        if (!controller.signal.aborted) res.json({ source: 'gemini', cards });
      }
      if (controller.signal.aborted && !res.destroyed) throw new ApiError(504, 'TIMEOUT', 'A geração demorou demais. Tente novamente.');
    } finally { clearTimeout(timeout); res.off('close', onClose); running--; }
  }
  app.post('/api/gerar-cartas', (req, res, next) => handle(req, res, false).catch(next));
  app.post('/api/recomendacoes', (req, res, next) => handle(req, res, true).catch(next));
  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', error: 'Rota não encontrada.' }));
  app.use((error, req, res, _next) => {
    if (res.headersSent || res.destroyed) return;
    const requestId = randomUUID();
    let status = error instanceof ApiError ? error.status : 500;
    let code = error instanceof ApiError ? error.code : 'SERVER_ERROR';
    let message = error instanceof ApiError ? error.message : 'Não foi possível gerar agora. Tente novamente.';
    if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.message === 'TIMEOUT') {
      status = 504; code = 'TIMEOUT'; message = 'A geração demorou demais. Tente novamente.';
    }
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      status = error.type === 'entity.too.large' ? 413 : 400; code = 'INVALID_BODY'; message = 'Pedido inválido.';
    }
    // Não registra chave, prompts ou resposta bruta do provedor.
    console.warn(JSON.stringify({ requestId, path: req.path, status, code }));
    res.status(status).json({ code, error: message, requestId });
  });
  return app;
}
if (require.main === module) {
  const app = createApp();
  const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Passa a Bola API iniciada.'));
  server.requestTimeout = 90000;
  process.on('SIGTERM', () => server.close());
}
module.exports = { createApp };
