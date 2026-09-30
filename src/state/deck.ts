import type { ConversationCard } from '../types/ai';

export type DeckState = {
  queue: ConversationCard[];
  history: string[];
  completed: number;
  skipped: number;
  received: number;
  loading: boolean;
  error: string | null;
};
export const initialDeckState: DeckState = {
  queue: [], history: [], completed: 0, skipped: 0, received: 0,
  loading: false, error: null,
};
export type DeckAction =
  | { type: 'loading' }
  | { type: 'append'; cards: ConversationCard[] }
  | { type: 'failure'; message: string }
  | { type: 'cancel' }
  | { type: 'advance'; skipped: boolean };

export function shouldPrefetch(state: DeckState, enabled: boolean): boolean {
  return enabled && state.queue.length <= 2 && !state.loading && !state.error;
}
export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case 'loading': return { ...state, loading: true, error: null };
    case 'append': {
      const seen = new Set([...state.history, ...state.queue.map(c => c.question)].map(textKey));
      const cards: ConversationCard[] = [];
      for (const card of action.cards) {
        const key = textKey(card.question);
        if (!seen.has(key)) { seen.add(key); cards.push(card); }
      }
      if (!cards.length) return { ...state, loading: false, error: 'A IA repetiu as cartas anteriores. Tente novamente.' };
      return {
        ...state, queue: [...state.queue, ...cards], received: state.received + cards.length,
        history: [...state.history, ...cards.map(c => c.question)].slice(-30), loading: false, error: null,
      };
    }
    case 'failure': return { ...state, loading: false, error: action.message };
    case 'cancel': return { ...state, loading: false };
    case 'advance':
      if (!state.queue.length) return state;
      return {
        ...state, queue: state.queue.slice(1),
        completed: state.completed + (action.skipped ? 0 : 1),
        skipped: state.skipped + (action.skipped ? 1 : 0),
      };
  }
}
function textKey(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
