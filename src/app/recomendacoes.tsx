import { Image } from 'expo-image';
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
	const p = useLocalSearchParams<{ mood?: Param; temas?: Param; formato?: Param; estilo?: Param; interesses?: Param; evitar?: Param }>();
	const mood = first(p.mood);
	const topicsRaw = first(p.temas);
	const rawFormat = first(p.formato);
	const format = (['filme', 'serie', 'musica', 'video', 'surpresa'].includes(rawFormat) ? rawFormat : 'surpresa') as RecommendationFormat;
	const preferences = { style: first(p.estilo), interests: first(p.interesses), avoid: first(p.evitar) };
	return <Recommendations key={JSON.stringify([mood, topicsRaw, format, preferences])} mood={mood} topicsRaw={topicsRaw} format={format} preferences={preferences} />;
}
function Recommendations({ mood, topicsRaw, format, preferences }: { mood: string; topicsRaw: string; format: RecommendationFormat; preferences: { style: string; interests: string; avoid: string } }) {
	const preferencesKey = JSON.stringify(preferences);
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
			const results = await requestRecommendations({ mode: 'recomendacoes', mood, topics: topicsFrom(topicsRaw), format, ...JSON.parse(preferencesKey), exclude: history.current.slice(-30) }, controller.signal);
			if (controller.signal.aborted) return;
			history.current = [...history.current, ...results.map(x => x.title)].slice(-30);
			setItems(results);
		} catch (e) {
			if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível buscar sugestões.');
		} finally {
			if (request.current === controller) { request.current = null; setLoading(false); }
		}
	}, [mood, topicsRaw, format, preferencesKey]);
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
				<Text accessibilityRole="header" style={s.title}>Pra curtir{'\n'}tua vibe.</Text>
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
						{items.map(item => <RecommendationCard key={item.id} item={item} onOpen={() => void open(item)} />)}
						<Text style={s.description}>As informações são geradas por inteligência artificial. Disponibilidade e preços podem variar.</Text>
						<Pressable accessibilityRole="button" onPress={() => void load()} style={s.button}><Text style={s.buttonText}>{error ? 'Tentar novamente' : 'Manda outras ↗'}</Text></Pressable>
					</>
				)}
			</ScrollView>
		</SafeAreaView>
	);
}
function RecommendationCard({ item, onOpen }: { item: Recommendation; onOpen: () => void }) {
	const [imageFailed, setImageFailed] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const poster = item.type === 'filme' || item.type === 'serie';
	const imageAvailable = !!item.artworkUrl && !imageFailed;
	return <View style={s.recommendationCard}>
		<Pressable accessibilityRole="link" accessibilityLabel={`Abrir ${item.title} na fonte`} onPress={onOpen} style={[s.artworkBox, { aspectRatio: poster ? 0.8 : item.type === 'musica' ? 1 : 16 / 9 }]}>
			{imageAvailable
				? <Image source={{ uri: item.artworkUrl! }} style={s.artwork} contentFit="contain" accessibilityLabel={`Capa de ${item.title}`} onError={() => setImageFailed(true)} />
				: <View style={s.imagePlaceholder}><Text style={s.placeholderIcon}>{item.type === 'musica' ? '♫' : '▶'}</Text><Text style={s.description}>Capa indisponível</Text></View>}
		</Pressable>
		<View style={s.cardBody}>
			<Text style={s.label}>{labels[item.type]}</Text>
			<Text style={s.cardTitle}>{item.title}</Text>
			{!!item.creator && <Text style={s.description}>{item.creator}</Text>}
			<Text style={s.metadata}>{[item.year, item.durationMinutes ? `${item.durationMinutes} min${item.type === 'serie' ? '/episódio' : ''}` : null, ...item.genres].filter(Boolean).join(' • ')}</Text>
			<Text style={s.sectionLabel}>POR QUE COMBINA CONTIGO</Text>
			<Text style={s.reason}>{item.reason}</Text>
			<Text style={s.sectionLabel}>{item.synopsisLabel.toUpperCase()}</Text>
			<Text numberOfLines={expanded ? undefined : 5} style={s.description}>{item.synopsis || 'Essa fonte não disponibilizou uma descrição.'}</Text>
			{!!item.synopsis && item.synopsis.length > 220 && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(x => !x)} style={s.readMore}><Text style={s.readMoreText}>{expanded ? 'Mostrar menos −' : 'Ler mais +'}</Text></Pressable>}
			<Pressable accessibilityRole="link" onPress={onOpen} style={s.button}><Text style={s.buttonText}>{item.type === 'video' ? 'Procurar no YouTube ↗' : 'Procurar onde assistir ↗'}</Text></Pressable>
		</View>
	</View>;
}
const s = StyleSheet.create({
	screen: { flex: 1, backgroundColor: '#0B140F' },
	recommendationCard: { backgroundColor: '#18271D', borderRadius: 26, marginTop: 24, borderWidth: 1, borderColor: '#334A39', overflow: 'hidden' },
	artworkBox: { width: '100%', backgroundColor: '#101A14', maxHeight: 440 },
	artwork: { width: '100%', height: '100%' },
	cardBody: { padding: 22 },
	imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
	placeholderIcon: { color: '#BCA5F5', fontSize: 64 },
	metadata: { color: '#B4C0B8', fontSize: 13, lineHeight: 20, marginTop: 10 },
	sectionLabel: { color: '#BCA5F5', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 24 },
	readMore: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
	readMoreText: { color: '#B7F34A', fontSize: 14, fontWeight: '700' },
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