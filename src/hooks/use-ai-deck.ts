import { useCallback, useEffect, useReducer, useRef } from 'react';
import { requestCards } from '../services/ai';
import type { GenerationInput } from '../types/ai';
import { deckReducer, initialDeckState, shouldPrefetch } from '../state/deck';

export function useAiDeck(config: Omit<GenerationInput, 'exclude'>, enabled: boolean) {
  const [state, dispatch] = useReducer(deckReducer, initialDeckState);
  const latest = useRef(state);
  const request = useRef<AbortController | null>(null);
  const active = useRef(false);
  const configKey = JSON.stringify(config);
  useEffect(() => { latest.current = state; }, [state]);

  const load = useCallback(async () => {
    // Mutex imediato: toques rápidos e efeitos nunca disparam dois lotes juntos.
    if (!active.current || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    dispatch({ type: 'loading' });
    try {
      const cards = await requestCards({
        ...(JSON.parse(configKey) as Omit<GenerationInput, 'exclude'>),
        exclude: latest.current.history.slice(-30),
      }, controller.signal);
      if (!controller.signal.aborted && active.current) dispatch({ type: 'append', cards });
    } catch (error) {
      if (!controller.signal.aborted && active.current) dispatch({ type: 'failure', message: error instanceof Error ? error.message : 'Não foi possível preparar as próximas cartas.' });
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [configKey]);

  useEffect(() => {
    active.current = enabled;
    if (!enabled) {
      request.current?.abort(); request.current = null;
      dispatch({ type: 'cancel' });
    }
    return () => {
      active.current = false;
      request.current?.abort(); request.current = null;
    };
  }, [enabled, configKey]);

  useEffect(() => {
    if (shouldPrefetch(state, enabled)) void load();
  }, [enabled, state, load]);

  const advance = useCallback((skipped: boolean) => dispatch({ type: 'advance', skipped }), []);
  const cancel = useCallback(() => {
    active.current = false;
    request.current?.abort(); request.current = null;
    dispatch({ type: 'cancel' });
  }, []);
  return { ...state, load, advance, cancel };
}
