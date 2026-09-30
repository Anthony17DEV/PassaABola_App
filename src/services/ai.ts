import type { ConversationCard, GenerationInput, Recommendation, RecommendationFormat } from '../types/ai';

function getBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!configured) throw new Error('Configure EXPO_PUBLIC_API_URL no .env do app e reinicie o Expo.');
  const url = new URL(configured);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('O endereço da API é inválido.');
  if (!__DEV__ && url.protocol !== 'https:') throw new Error('A versão publicada precisa de uma API HTTPS.');
  return configured;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('O servidor devolveu uma resposta inválida.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 1000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('O servidor devolveu conteúdo incompleto.');
  return value;
}
async function fetchJSON(url: string, init: RequestInit, external: AbortSignal, milliseconds: number): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  external.addEventListener('abort', abort);
  if (external.aborted) controller.abort();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, milliseconds);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let data: unknown;
    try { data = JSON.parse(raw); }
    catch { throw new Error('O servidor ainda não respondeu corretamente. Aguarde e tente novamente.'); }
    if (!response.ok) {
      const body = record(data);
      throw new Error(typeof body.error === 'string' ? body.error : 'Não foi possível gerar agora.');
    }
    return data;
  } catch (error) {
    if (timedOut) throw new Error('O servidor demorou para responder. Aguarde um pouco e tente novamente.');
    if (external.aborted) throw error;
    if (error instanceof TypeError) throw new Error('Não conseguimos acessar o servidor. Confira sua internet e o endereço da API.');
    throw error;
  } finally {
    clearTimeout(timer);
    external.removeEventListener('abort', abort);
  }
}
async function post(path: string, body: unknown, signal: AbortSignal) {
  const base = getBaseUrl();
  // Hospedagem gratuita pode estar adormecida. Acorda antes de gastar uma geração.
  const health = record(await fetchJSON(`${base}/health`, { method: 'GET' }, signal, 90000));
  if (health.ok !== true || health.service !== 'passa-a-bola-api') throw new Error('O endereço configurado não aponta para a API do Passa a Bola.');
  if (signal.aborted) throw new Error('Pedido cancelado.');
  return record(await fetchJSON(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, signal, 85000));
}
export async function requestCards(input: GenerationInput, signal: AbortSignal): Promise<ConversationCard[]> {
  const payload = await post('/api/gerar-cartas', input, signal);
  if (payload.source !== 'gemini' || !Array.isArray(payload.cards) || payload.cards.length !== 5) throw new Error('O servidor não retornou cinco cartas válidas.');
  const ids = new Set<string>();
  return payload.cards.map((value: unknown) => {
    const c = record(value);
    const id = text(c.id, 100);
    if (ids.has(id)) throw new Error('O servidor retornou cartas duplicadas.');
    ids.add(id);
    if (c.kind !== 'question' && c.kind !== 'challenge') throw new Error('Tipo de carta inválido.');
    return {
      id, kind: c.kind, topic: text(c.topic, 60), moods: [input.mood],
      question: text(c.question, 500), followUp: text(c.followUp, 600), groupFollowUp: text(c.groupFollowUp, 600),
    };
  });
}
export function isSafeRecommendationUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && ['music.apple.com', 'itunes.apple.com', 'tv.apple.com', 'www.tvmaze.com', 'tvmaze.com', 'www.youtube.com'].includes(u.hostname);
  } catch { return false; }
}
export function isSafeArtworkUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') &&
      (u.hostname.endsWith('.mzstatic.com') || u.hostname.endsWith('.itunes.apple.com') || ['static.tvmaze.com', 'i.ytimg.com', 'img.youtube.com'].includes(u.hostname));
  } catch { return false; }
}
export async function requestRecommendations(input: GenerationInput & { format: RecommendationFormat }, signal: AbortSignal): Promise<Recommendation[]> {
  const payload = await post('/api/recomendacoes', input, signal);
  if (payload.source !== 'gemini' || !Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 3) throw new Error('Não recebemos sugestões confirmadas.');
  return payload.items.map((value: unknown) => {
    const r = record(value);
    const url = text(r.url, 2000);
    if (!isSafeRecommendationUrl(url) || !['filme', 'serie', 'musica', 'video'].includes(String(r.type))) throw new Error('Uma sugestão veio com um link inválido.');
    return {
      id: text(r.id, 100), type: r.type as Recommendation['type'], title: text(r.title, 300),
      creator: typeof r.creator === 'string' ? r.creator : '', reason: text(r.reason, 500), source: text(r.source, 100), url,
      artworkUrl: isSafeArtworkUrl(r.artworkUrl) ? r.artworkUrl : null,
      synopsis: typeof r.synopsis === 'string' && r.synopsis.length <= 1200 ? r.synopsis : null,
      synopsisLabel: typeof r.synopsisLabel === 'string' ? r.synopsisLabel.slice(0, 80) : 'Sobre a indicação',
      year: typeof r.year === 'number' ? r.year : null,
      durationMinutes: typeof r.durationMinutes === 'number' && r.durationMinutes > 0 ? r.durationMinutes : null,
      genres: Array.isArray(r.genres) ? r.genres.filter((x): x is string => typeof x === 'string').slice(0, 6) : [],
    };
  });
}
