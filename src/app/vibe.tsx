import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHALLENGE_STYLES, FORMATS, MOODS, RECOMMENDATION_STYLES, TALK_STYLES, TOPICS } from '../config/session-options';

type Param = string | string[] | undefined;
const first = (p: Param) => Array.isArray(p) ? p[0] ?? '' : p ?? '';
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
	return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [s.chip, selected && s.chipSelected, pressed && { opacity: 0.75 }]}>
		<Text style={[s.chipText, selected && s.chipTextSelected]}>{label}</Text>
	</Pressable>;
}
function CustomChoice({ placeholder, onAdd, maxLength = 60 }: { placeholder: string; onAdd: (value: string) => void; maxLength?: number }) {
	const [value, setValue] = useState('');
	function add() { const next = value.trim(); if (!next) return; onAdd(next); setValue(''); Keyboard.dismiss(); }
	return <View style={s.inputRow}>
		<TextInput accessibilityLabel={placeholder} value={value} onChangeText={setValue} placeholder={placeholder} placeholderTextColor="#82918A" style={[s.input, { flex: 1 }]} maxLength={maxLength} returnKeyType="done" onSubmitEditing={add} />
		<Pressable accessibilityRole="button" accessibilityLabel="Adicionar opção personalizada" disabled={!value.trim()} onPress={add} style={[s.add, !value.trim() && { opacity: 0.4 }]}><Text style={s.addText}>+</Text></Pressable>
	</View>;
}
export default function VibeScreen() {
	const p = useLocalSearchParams<{ sessao?: Param; modo?: Param; titulo?: Param }>();
	const mode = first(p.modo);
	const isChallenge = mode === 'desafios-solo';
	const recommendations = mode === 'recomendacoes';
	const defaults = isChallenge ? CHALLENGE_STYLES : recommendations ? RECOMMENDATION_STYLES : TALK_STYLES;
	const [mood, setMood] = useState('Dar risada');
	const [moods, setMoods] = useState(MOODS);
	const [topics, setTopics] = useState<string[]>([]);
	const [customTopics, setCustomTopics] = useState<string[]>([]);
	const [style, setStyle] = useState(defaults[0]!);
	const [customStyles, setCustomStyles] = useState<string[]>([]);
	const [interests, setInterests] = useState('');
	const [avoid, setAvoid] = useState('');
	const [format, setFormat] = useState('surpresa');
	const canStart = ['brisa-solo', 'desafios-solo', 'papo'].includes(mode) || (recommendations && first(p.sessao) !== 'amigos');

	function toggleTopic(topic: string) {
		if (!topics.includes(topic) && topics.length >= 10) { Alert.alert('Até dez temas', 'Desmarca um tema para incluir outro.'); return; }
		setTopics(current => current.includes(topic) ? current.filter(x => x !== topic) : [...current, topic]);
	}
	function addTopic(value: string) {
		const existing = [...TOPICS, ...customTopics].find(x => x.toLocaleLowerCase() === value.toLocaleLowerCase());
		const topic = existing || value;
		if (!topics.includes(topic) && topics.length >= 10) { Alert.alert('Até dez temas', 'Desmarca um tema para incluir outro.'); return; }
		if (!existing) setCustomTopics(current => [...current, topic]);
		setTopics(current => current.includes(topic) ? current : [...current, topic]);
	}
	function start() {
		if (!canStart) return;
		Keyboard.dismiss();
		router.push({
			pathname: recommendations ? '/recomendacoes' : '/jogar', params: {
				modo: mode, mood, temas: JSON.stringify(topics), formato: format,
				estilo: style, interesses: interests.trim(), evitar: avoid.trim(),
			}
		});
	}
	return <SafeAreaView style={s.screen}>
		<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
			<ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
				<Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/sessao')} style={s.back}><Text style={s.backText}>← Voltar</Text></Pressable>
				<Text style={s.eyebrow}>{first(p.titulo).toUpperCase() || 'DO SEU JEITO'}</Text>
				<Text accessibilityRole="header" style={s.title}>{recommendations ? 'O que combina\ncontigo?' : isChallenge ? 'Qual vai ser\no desafio?' : 'Puxa um assunto\nque tu curte.'}</Text>
				<Text style={s.description}>Escolhe uma opção ou inventa a tua. Quanto mais contexto, mais a sessão fica com tua cara.</Text>
				{recommendations && <><Text style={s.label}>Quero assistir ou ouvir...</Text><View style={s.chips}>{FORMATS.map(x => <Chip key={x.id} label={x.label} selected={format === x.id} onPress={() => setFormat(x.id)} />)}</View></>}

				<Text style={s.label}>Qual é o clima?</Text>
				<View style={s.chips}>{moods.map(x => <Chip key={x} label={x} selected={mood === x} onPress={() => setMood(x)} />)}</View>
				<CustomChoice placeholder="Minha vibe, do meu jeito" onAdd={value => { setMoods(current => current.includes(value) ? current : [...current, value]); setMood(value); }} />

				<Text style={s.label}>{isChallenge ? 'Tipo de desafio' : recommendations ? 'Estilo da descoberta' : 'Estilo da conversa'}</Text>
				<View style={s.chips}>{[...defaults, ...customStyles].map(x => <Chip key={x} label={x} selected={style === x} onPress={() => setStyle(x)} />)}</View>
				<CustomChoice maxLength={100} placeholder={isChallenge ? 'Ex.: improvisar rimas' : recommendations ? 'Ex.: ficção científica esquisita' : 'Ex.: humor ácido sobre o cotidiano'} onAdd={value => { if (![...defaults, ...customStyles].includes(value)) setCustomStyles(current => [...current, value]); setStyle(value); }} />

				<Text style={s.label}>{recommendations ? 'Quais assuntos te interessam?' : 'Sobre o quê?'}</Text>
				<Text style={s.hint}>Até dez temas. Sem marcar nenhum, a IA usa teu contexto para variar.</Text>
				<View style={s.chips}>{[...TOPICS, ...customTopics].map(x => <Chip key={x} label={x} selected={topics.includes(x)} onPress={() => toggleTopic(x)} />)}</View>
				<CustomChoice placeholder="Ex.: anime, rap, vida de programador" onAdd={addTopic} />

				<Text style={s.label}>Conta mais do que tu curte</Text>
				<TextInput accessibilityLabel="Seus interesses e referências" multiline value={interests} onChangeText={setInterests} maxLength={600} placeholder={recommendations ? 'Ex.: gosto de suspense que prende, rap melódico e documentário sobre espaço. Quero fugir dos títulos óbvios.' : 'Ex.: curto Naruto, rap, jogos antigos e zoar as situações absurdas de trabalhar com tecnologia.'} placeholderTextColor="#82918A" style={[s.input, s.multiline]} />
				<Text style={s.counter}>{interests.length}/600</Text>

				<Text style={s.label}>Tem algo que tu quer evitar?</Text>
				<TextInput accessibilityLabel="Assuntos a evitar" multiline value={avoid} onChangeText={setAvoid} maxLength={300} placeholder="Opcional: terror, papo de relacionamento, spoilers..." placeholderTextColor="#82918A" style={[s.input, s.multilineSmall]} />

				<View style={s.summary}><Text style={s.eyebrow}>TUA SESSÃO</Text><Text style={s.summaryTitle}>{mood}</Text><Text style={s.description}>{style}{'\n'}{topics.length ? topics.join(' • ') : 'Temas livres'}</Text></View>
				{canStart && <Pressable accessibilityRole="button" onPress={start} style={({ pressed }) => [s.start, pressed && { opacity: 0.8 }]}><Text style={s.startText}>{recommendations ? 'Encontrar minha próxima descoberta ↗' : 'Bora começar ↗'}</Text></Pressable>}
			</ScrollView>
		</KeyboardAvoidingView>
	</SafeAreaView>;
}
const s = StyleSheet.create({
	screen: { flex: 1, backgroundColor: '#0B140F' },
	content: { padding: 24, paddingBottom: 48, maxWidth: 620, width: '100%', alignSelf: 'center' },
	back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: 28 },
	backText: { color: '#F6F7EF', fontSize: 16 },
	eyebrow: { color: '#BCA5F5', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
	title: { color: '#F6F7EF', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
	description: { color: '#B4C0B8', fontSize: 16, lineHeight: 24, marginTop: 12 },
	label: { color: '#F6F7EF', fontSize: 20, fontWeight: '700', marginTop: 30, marginBottom: 12 },
	hint: { color: '#B4C0B8', fontSize: 14, lineHeight: 21, marginBottom: 14 },
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
	chip: { minHeight: 48, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 18, borderWidth: 1, borderColor: '#35453B', backgroundColor: '#142219', maxWidth: '100%' },
	chipSelected: { backgroundColor: '#B7F34A', borderColor: '#B7F34A' },
	chipText: { color: '#E3EAE4', fontSize: 15, fontWeight: '600' },
	chipTextSelected: { color: '#102019' },
	inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
	input: { backgroundColor: '#142219', borderWidth: 1, borderColor: '#35453B', borderRadius: 16, padding: 14, minHeight: 52, color: '#F6F7EF', fontSize: 16 },
	multiline: { minHeight: 120, textAlignVertical: 'top' },
	multilineSmall: { minHeight: 80, textAlignVertical: 'top' },
	add: { width: 52, height: 52, backgroundColor: '#BCA5F5', alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
	addText: { color: '#211E30', fontWeight: '800', fontSize: 26 },
	counter: { color: '#82918A', fontSize: 12, textAlign: 'right', marginTop: 6 },
	summary: { marginTop: 30, padding: 22, borderRadius: 24, backgroundColor: '#19271F' },
	summaryTitle: { color: '#F6F7EF', fontSize: 24, fontWeight: '800' },
	start: { minHeight: 60, backgroundColor: '#B7F34A', borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 24 },
	startText: { color: '#102019', fontSize: 17, fontWeight: '800', textAlign: 'center' },
});