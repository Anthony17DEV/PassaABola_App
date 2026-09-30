import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isSafeRecommendationUrl, requestRecommendations } from '../services/ai';
import type { Recommendation, RecommendationFormat } from '../types/ai';

type Param = string | string[] | undefined;
const first = (value: Param) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
const labels = { filme: 'FILME', serie: 'SÉRIE', musica: 'MÚSICA', video: 'VÍDEO' };
function topicsFrom(raw: string): string[] {
  try { const result: unknown = JSON.parse(raw); return Array.isArray(result) ? result.filter((x): x is string => typeof x === 'string') : []; }
  catch { return []; }
}
export default function RecommendationsScreen() {
  const p = useLocalSearchParams<{ mood?: Param; temas?: Param; formato?: Param }>();
  const mood = first(p.mood);
  const topicsRaw = first(p.temas);
  const rawFormat = first(p.formato);
  const format = (['filme', 'serie', 'musica', 'video', 'surpresa'].includes(rawFormat) ? rawFormat : 'surpresa') as RecommendationFormat;
  return <Recommendations key={JSON.stringify([mood, topicsRaw, format])} mood={mood} topicsRaw={topicsRaw} format={format} />;
}
function Recommendations({ mood, topicsRaw, format }: { mood: string; topicsRaw: string; format: RecommendationFormat }) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const history = useRef<string[]>([]);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(null);
    try {
      const results = await requestRecommendations({ mode: 'recomendacoes', mood, topics: topicsFrom(topicsRaw), format, exclude: history.current.slice(-30) }, controller.signal);
      if (controller.signal.aborted) return;
      history.current = [...history.current, ...results.map(x => x.title)].slice(-30);
      setItems(results);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível buscar sugestões.');
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }, [mood, topicsRaw, format]);
  useEffect(() => {
    void load();
    return () => { request.current?.abort(); request.current = null; };
  }, [load]);
  function back() {
    request.current?.abort(); request.current = null;
    if (router.canGoBack()) router.back(); else router.replace('/sessao');
  }
  async function open(item: Recommendation) {
    try {
      if (!isSafeRecommendationUrl(item.url)) throw new Error('invalid');
      await Linking.openURL(item.url);
    } catch { Alert.alert('Não foi possível abrir', 'Tente novamente em alguns instantes.'); }
  }
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable accessibilityRole="button" onPress={back} style={s.back}><Text style={s.text}>← Voltar</Text></Pressable>
        <Text style={s.label}>RECOMENDAÇÕES • SOLO</Text>
        <Text accessibilityRole="header" style={s.title}>Pra curtir{ '\n' }tua vibe.</Text>
        <Text style={s.description}>{mood}</Text>
        {loading ? (
          <View style={s.card}>
            <ActivityIndicator color="#B7F34A" size="large" />
            <Text style={s.cardTitle}>Escolhendo e conferindo...</Text>
            <Text style={s.description}>Buscando sugestões que combinem contigo. O primeiro acesso pode levar até dois minutos.</Text>
            <Pressable accessibilityRole="button" onPress={back} style={s.back}><Text style={s.text}>Cancelar e voltar</Text></Pressable>
          </View>
        ) : (
          <>
            {error && <View style={s.card}><Text style={s.cardTitle}>Não deu pra buscar agora</Text><Text style={s.description}>{error}</Text></View>}
            {!error && items.map(item => (
              <View key={item.id} style={s.card}>
                <Text style={s.label}>{labels[item.type]}</Text>
                <Text style={s.cardTitle}>{item.title}</Text>
                {!!item.creator && <Text style={s.description}>{item.creator}</Text>}
                <Text style={s.reason}>{item.reason}</Text>
                <Text style={s.source}>Título conferido em {item.source}</Text>
                <Pressable accessibilityRole="link" onPress={() => void open(item)} style={s.button}>
                  <Text style={s.buttonText}>{item.type === 'video' ? 'Abrir no YouTube ↗' : 'Ver no catálogo ↗'}</Text>
                </Pressable>
              </View>
            ))}
            <Text style={s.description}>Os links abrem as fontes. Disponibilidade para assistir ou ouvir e preços podem variar. Algumas buscas podem retornar menos de três sugestões confirmadas.</Text>
            {!error && items.some(x => x.type === 'serie') && <Text style={s.source}>Dados de séries: TVmaze • CC BY-SA. O link do card identifica a fonte.</Text>}
            <Pressable accessibilityRole="button" onPress={() => void load()} style={s.button}><Text style={s.buttonText}>{error ? 'Tentar novamente' : 'Manda outras ↗'}</Text></Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B140F' },
  content: { padding: 24, paddingBottom: 48, width: '100%', maxWidth: 600, alignSelf: 'center' },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 16 },
  text: { color: '#F6F7EF', fontSize: 16 },
  label: { color: '#BCA5F5', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#F6F7EF', fontSize: 38, fontWeight: '900', marginTop: 14 },
  description: { color: '#B4C0B8', fontSize: 15, lineHeight: 23, marginTop: 12 },
  card: { padding: 22, backgroundColor: '#18271D', borderRadius: 26, marginTop: 24, borderWidth: 1, borderColor: '#334A39' },
  cardTitle: { color: '#F6F7EF', fontSize: 24, fontWeight: '800', marginTop: 12 },
  reason: { color: '#E3EAE4', fontSize: 17, lineHeight: 26, marginTop: 18 },
  source: { color: '#B4C0B8', fontSize: 12, lineHeight: 19, marginTop: 16 },
  button: { backgroundColor: '#B7F34A', borderRadius: 18, padding: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  buttonText: { color: '#102019', fontSize: 16, fontWeight: '800' },
});
