import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../components/brand-logo';
import { useAiDeck } from '../hooks/use-ai-deck';
import type { GenerationInput } from '../types/ai';

type Param = string | string[] | undefined;
type Phase = 'waiting' | 'shuffling' | 'dealing' | 'hidden' | 'flipping' | 'revealed' | 'discarding' | 'finished';
const first = (value: Param) => Array.isArray(value) ? value[0] ?? '' : value ?? '';

function parseArray(value: string): string[] {
	try {
		const data: unknown = JSON.parse(value);
		return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

export default function PlayScreen() {
	const p = useLocalSearchParams<{ modo?: Param; mood?: Param; temas?: Param; estilo?: Param; interesses?: Param; evitar?: Param; jogadores?: Param }>();

	const config = {
		mode: first(p.modo),
		mood: first(p.mood),
		topics: parseArray(first(p.temas)),
		style: first(p.estilo),
		interests: first(p.interesses),
		avoid: first(p.evitar),
	};

	const players = parseArray(first(p.jogadores));

	return <CardSession key={JSON.stringify(config)} config={config} players={players} />;
}

function CardSession({ config, players }: { config: Omit<GenerationInput, 'exclude'>, players: string[] }) {
	const { width, height } = useWindowDimensions();
	const reduceMotion = useReducedMotion();
	const { mode, mood } = config;

	const supported = ['brisa-solo', 'desafios-solo', 'papo', 'passa-a-bola', 'quem-da-roda', 'missoes'].includes(mode);
	const isChallenge = mode === 'desafios-solo' || mode === 'missoes';
	const isGroup = players.length > 0;

	const title = isGroup ? 'Resenha com a galera' : isChallenge ? 'Desafios solo' : 'Brisa solo';

	const [phase, setPhase] = useState<Phase>('waiting');
	const [expanded, setExpanded] = useState(false);
	const [skipCurrent, setSkipCurrent] = useState(false);
	const [appActive, setAppActive] = useState(AppState.currentState === 'active');
	const interaction = useRef(false);

	const deck = useAiDeck(config, supported && phase !== 'finished' && appActive);
	const { advance, cancel } = deck;
	const card = deck.queue[0];
	const completedCount = deck.completed + deck.skipped;

	const currentPlayer = isGroup ? players[completedCount % players.length] : null;

	const cardHeight = Math.max(360, Math.min(height * 0.55, 500));
	const hidden = phase === 'hidden';
	const revealed = phase === 'revealed';
	const shuffling = phase === 'shuffling';

	const shuffle = useRef(new Animated.Value(0)).current;
	const flip = useRef(new Animated.Value(0)).current;
	const travel = useRef(new Animated.Value(0)).current;
	const arrival = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
		return () => subscription.remove();
	}, []);

	useEffect(() => {
		if (phase === 'waiting' && card) {
			setExpanded(false);
			setPhase(completedCount === 0 ? 'shuffling' : 'dealing');
		}
	}, [phase, card, completedCount]);

	useEffect(() => {
		if (phase === 'hidden' || phase === 'revealed') interaction.current = false;
		let active = true;
		let animation: Animated.CompositeAnimation | undefined;
		const timing = (value: Animated.Value, toValue: number, duration: number) => Animated.timing(value, {
			toValue, duration: reduceMotion ? 0 : duration, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
		});
		if (phase === 'shuffling') {
			shuffle.setValue(0); flip.setValue(0); travel.setValue(0); arrival.setValue(1);
			animation = Animated.sequence([timing(shuffle, 1, 220), timing(shuffle, -1, 300), timing(shuffle, 1, 300), timing(shuffle, -1, 300), timing(shuffle, 0, 220)]);
			animation.start(({ finished }) => { if (active && finished) setPhase('dealing'); });
		}
		if (phase === 'dealing') {
			flip.setValue(0); travel.setValue(0); arrival.setValue(0);
			animation = timing(arrival, 1, 320);
			animation.start(({ finished }) => { if (active && finished) setPhase('hidden'); });
		}
		if (phase === 'flipping') {
			animation = timing(flip, 1, 520);
			animation.start(({ finished }) => { if (active && finished) setPhase('revealed'); });
		}
		if (phase === 'discarding') {
			animation = timing(travel, (skipCurrent ? -1 : 1) * width * 1.3, 340);
			animation.start(({ finished }) => {
				if (!active || !finished) return;
				arrival.setValue(0);
				flip.setValue(0);
				travel.setValue(0);
				advance(skipCurrent);
				setExpanded(false);
				setPhase('waiting');
			});
		}
		return () => { active = false; animation?.stop(); };
	}, [phase, skipCurrent, width, reduceMotion, shuffle, flip, travel, arrival, advance]);

	function returnToSettings() {
		cancel();
		if (router.canGoBack()) router.back(); else router.replace('/sessao');
	}
	function revealCard() {
		if (!hidden || interaction.current) return;
		interaction.current = true; setPhase('flipping');
	}
	function discardCard(skip: boolean) {
		if (!revealed || interaction.current) return;
		interaction.current = true; setSkipCurrent(skip); setPhase('discarding');
	}
	function finishSession() { cancel(); setPhase('finished'); }

	if (!supported) return <SafeAreaView style={styles.screen}><View style={styles.centered}>
		<Text style={styles.title}>Esse modo ainda não está disponível.</Text>
		<Pressable accessibilityRole="button" onPress={returnToSettings} style={styles.primary}><Text style={styles.primaryText}>Voltar</Text></Pressable>
	</View></SafeAreaView>;

	if (phase === 'finished') return <SafeAreaView style={styles.screen}>
		<ScrollView contentContainerStyle={styles.finishedContent}>
			<BrandLogo size={84} />
			<Text style={styles.eyebrow}>SESSÃO ENCERRADA</Text>
			<Text accessibilityRole="header" style={styles.title}>{isChallenge ? 'Mandaram bem?' : isGroup ? 'Rendeu assunto?' : 'Deu uma viajada?'}</Text>
			<View style={styles.summary}>
				<Text style={styles.summaryText}>{deck.completed} carta(s) concluída(s)</Text>
				<Text style={styles.summaryText}>{deck.skipped} carta(s) pulada(s)</Text>
			</View>
			<Pressable accessibilityRole="button" onPress={returnToSettings} style={styles.primary}><Text style={styles.primaryText}>Escolher outra vibe</Text></Pressable>
		</ScrollView>
	</SafeAreaView>;

	if (!card) return <SafeAreaView style={styles.screen}><View style={styles.centered}>
		{!deck.error && <ActivityIndicator size="large" color="#B7F34A" />}
		<Text style={styles.title}>{deck.error ? 'Deu uma pausa na conexão' : completedCount ? 'A próxima já vem...' : 'Preparando tua sessão...'}</Text>
		<Text style={styles.mutedText}>{deck.error || (completedCount ? 'A IA está terminando as próximas cartas.' : 'Criando cartas com os assuntos que tu escolheu. O primeiro acesso pode demorar um pouco.')}</Text>
		{!!deck.error && <Pressable accessibilityRole="button" onPress={() => void deck.load()} style={styles.primary}><Text style={styles.primaryText}>Tentar novamente</Text></Pressable>}
		<Pressable accessibilityRole="button" onPress={completedCount ? finishSession : returnToSettings} style={styles.skipButton}><Text style={styles.mutedText}>{completedCount ? 'Encerrar sessão' : 'Cancelar e voltar'}</Text></Pressable>
	</View></SafeAreaView>;

	return (
		<SafeAreaView style={styles.screen}>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.topBar}>
					<Text style={styles.modeTitle}>{title}</Text>

					<Pressable
						accessibilityRole="button"
						onPress={finishSession}
						style={styles.textButton}
					>
						<Text style={styles.mutedText}>Encerrar</Text>
					</Pressable>
				</View>

				<Text style={[styles.eyebrow, isGroup && { color: '#B7F34A', fontSize: 14 }]}>
					{currentPlayer ? `A BOLA TÁ COM: ${currentPlayer.toUpperCase()}` : (mood.toUpperCase() || "DO SEU JEITO")}
				</Text>

				<View style={styles.progressRow}>
					<Text style={styles.mutedText}>
						Carta {completedCount + 1}
					</Text>

					<Text style={styles.smallText}>{deck.loading ? 'Preparando as próximas' : 'Gerado por IA'}</Text>
				</View>

				{!!deck.error && <View style={styles.bufferNotice}>
					<Text style={styles.mutedText}>As cartas já recebidas continuam disponíveis. {deck.error}</Text>
					<Pressable accessibilityRole="button" onPress={() => void deck.load()} style={styles.textButton}><Text style={styles.retryText}>Tentar preparar as próximas</Text></Pressable>
				</View>}

				<View style={[styles.deckArea, { height: cardHeight }]}>
					{[0, 1].map((layer) => (
						<Animated.View
							key={layer}
							pointerEvents="none"
							style={[
								styles.underCard,
								{
									backgroundColor: layer === 0 ? "#302844" : "#28402B",
									transform: [
										{
											translateX: shuffle.interpolate({
												inputRange: [-1, 0, 1],
												outputRange: layer === 0 ? [-42, -5, 42] : [42, 5, -42],
											}),
										},
										{ translateY: layer === 0 ? 12 : 6 },
										{
											rotate: shuffle.interpolate({
												inputRange: [-1, 0, 1],
												outputRange:
													layer === 0
														? ["-12deg", "-3deg", "12deg"]
														: ["12deg", "3deg", "-12deg"],
											}),
										},
										{ scale: layer === 0 ? 0.94 : 0.97 },
									],
								},
							]}
						/>
					))}

					<Animated.View
						style={[
							styles.activeCard,
							{
								opacity: Animated.multiply(
									arrival,
									travel.interpolate({
										inputRange: [-width, 0, width],
										outputRange: [0, 1, 0],
										extrapolate: "clamp",
									}),
								),
								transform: [
									{ translateX: travel },
									{
										translateY: arrival.interpolate({
											inputRange: [0, 1],
											outputRange: [45, 0],
										}),
									},
									{
										rotate: travel.interpolate({
											inputRange: [-width, 0, width],
											outputRange: ["-22deg", "0deg", "22deg"],
										}),
									},
								],
							},
						]}
					>
						<Animated.View
							pointerEvents={hidden ? "auto" : "none"}
							accessibilityElementsHidden={!hidden}
							importantForAccessibility={hidden ? "auto" : "no-hide-descendants"}
							style={[
								styles.face,
								styles.backFace,
								{
									opacity: flip.interpolate({
										inputRange: [0, 0.49, 0.5, 1],
										outputRange: [1, 1, 0, 0],
									}),
									transform: [
										{ perspective: 1200 },
										{
											rotateY: flip.interpolate({
												inputRange: [0, 1],
												outputRange: ["0deg", "180deg"],
											}),
										},
									],
								},
							]}
						>
							<Pressable
								accessibilityRole="button"
								disabled={!hidden}
								onPress={revealCard}
								style={styles.backTouchable}
							>
								<Text style={styles.cornerMark}>PB</Text>
								<View style={styles.backCenter}>
									<BrandLogo size={106} />
									<Text style={styles.backTitle}>PASSA{"\n"}A BOLA</Text>
									<Text style={styles.backCaption}>
										{currentPlayer ? `TUA VEZ, ${currentPlayer.toUpperCase()}` : "UMA IDEIA POR VEZ"}
									</Text>
								</View>
								<Text style={styles.touchHint}>Toque para revelar ?</Text>
							</Pressable>
						</Animated.View>

						<Animated.View
							pointerEvents={revealed ? "auto" : "none"}
							accessibilityElementsHidden={!revealed}
							importantForAccessibility={revealed ? "auto" : "no-hide-descendants"}
							style={[
								styles.face,
								styles.frontFace,
								{
									opacity: flip.interpolate({
										inputRange: [0, 0.49, 0.5, 1],
										outputRange: [0, 0, 1, 1],
									}),
									transform: [
										{ perspective: 1200 },
										{
											rotateY: flip.interpolate({
												inputRange: [0, 1],
												outputRange: ["-180deg", "0deg"],
											}),
										},
									],
								},
							]}
						>
							<ScrollView
								key={card.id}
								nestedScrollEnabled
								contentContainerStyle={styles.frontContent}
							>
								<View style={styles.cardHeading}>
									<Text style={styles.topic}>{card.topic}</Text>
									<Text style={styles.cardNumber}>
										{String(completedCount + 1).padStart(2, "0")}
									</Text>
								</View>

								<Text style={styles.question}>{card.question}</Text>

								{expanded && (
									<View style={styles.followUp}>
										<Text style={styles.followUpLabel}>
											{isGroup ? "JOGA PRA RODA" : isChallenge ? "COMO FAZER" : "VAI MAIS FUNDO"}
										</Text>
										<Text style={styles.followUpText}>
											{isGroup ? card.groupFollowUp : card.followUp}
										</Text>
									</View>
								)}

								<Pressable
									accessibilityRole="button"
									onPress={() =>
										setExpanded(current => !current)
									}
									style={styles.expandButton}
								>
									<Text style={styles.expandText}>
										{expanded ? "Recolher -" : isChallenge ? "Ver instruções +" : "Faz render +"}
									</Text>
								</Pressable>
							</ScrollView>
						</Animated.View>
					</Animated.View>
				</View>

				<Text style={styles.hint}>
					{shuffling
						? "Misturando..."
						: revealed
							? isGroup ? `Lá pra roda, ${currentPlayer}!` : isChallenge ? "Faz no teu ritmo. Pode pular quando quiser." : "Pensa no teu tempo."
							: "Sua carta chegou."}
				</Text>

				{revealed && (
					<>
						<Pressable
							accessibilityRole="button"
							onPress={() => discardCard(false)}
							style={({ pressed }) => [
								styles.primary,
								pressed && styles.pressed,
							]}
						>
							<Text style={styles.primaryText}>
								{isChallenge && !isGroup ? "Concluir. Próximo" : "Passar a bola"}
							</Text>
						</Pressable>

						<Pressable
							accessibilityRole="button"
							onPress={() => discardCard(true)}
							style={styles.skipButton}
						>
							<Text style={styles.mutedText}>Pular essa</Text>
						</Pressable>
					</>
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#0B140F" },
	bufferNotice: { backgroundColor: '#211E30', padding: 14, borderRadius: 16, marginBottom: 18 },
	retryText: { color: '#BCA5F5', fontSize: 14, fontWeight: '700' },
	content: {
		padding: 24,
		paddingBottom: 40,
		width: "100%",
		maxWidth: 520,
		alignSelf: "center",
	},
	topBar: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		marginBottom: 20,
	},
	modeTitle: { flex: 1, color: "#F6F7EF", fontSize: 17, fontWeight: "700" },
	textButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
	mutedText: { color: "#B4C0B8", fontSize: 15 },
	smallText: { color: "#B4C0B8", fontSize: 12 },
	eyebrow: {
		color: "#BCA5F5",
		fontSize: 12,
		fontWeight: "800",
		letterSpacing: 2,
	},
	progressRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		gap: 10,
		marginTop: 14,
		marginBottom: 28,
	},
	deckArea: { position: "relative", marginHorizontal: 8 },
	underCard: {
		...StyleSheet.absoluteFill,
		borderRadius: 28,
		borderWidth: 1,
		borderColor: "#506047",
	},
	activeCard: { ...StyleSheet.absoluteFill },
	face: {
		...StyleSheet.absoluteFill,
		borderRadius: 28,
		borderWidth: 1,
		backfaceVisibility: "hidden",
		overflow: "hidden",
	},
	backFace: { backgroundColor: "#1A2B1E", borderColor: "#749550" },
	backTouchable: { flex: 1, padding: 24, justifyContent: "space-between" },
	cornerMark: {
		color: "#B7F34A",
		fontSize: 18,
		fontWeight: "900",
		letterSpacing: -1,
	},
	backCenter: { alignItems: "center", gap: 18 },
	backTitle: {
		color: "#F6F7EF",
		fontSize: 32,
		lineHeight: 34,
		fontWeight: "900",
		textAlign: "center",
		letterSpacing: -1,
	},
	backCaption: {
		color: "#BCA5F5",
		fontSize: 10,
		fontWeight: "800",
		letterSpacing: 2,
		textAlign: "center",
	},
	touchHint: {
		color: "#B7F34A",
		fontSize: 14,
		fontWeight: "700",
		textAlign: "center",
		marginTop: 16,
	},
	frontFace: { backgroundColor: "#F1EEDC", borderColor: "#D4D1BD" },
	frontContent: { flexGrow: 1, padding: 24 },
	cardHeading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		marginBottom: 26,
	},
	topic: { flex: 1, color: "#435B37", fontSize: 14, fontWeight: "800" },
	cardNumber: { color: "#6A725F", fontSize: 18, fontWeight: "800" },
	question: {
		color: "#18271D",
		fontSize: 26,
		lineHeight: 35,
		fontWeight: "800",
	},
	followUp: {
		marginTop: 24,
		paddingTop: 20,
		borderTopWidth: 1,
		borderTopColor: "#C9CCB8",
	},
	followUpLabel: {
		color: "#655086",
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1.5,
		marginBottom: 10,
	},
	followUpText: { color: "#36422E", fontSize: 17, lineHeight: 26 },
	expandButton: {
		minHeight: 48,
		justifyContent: "center",
		alignSelf: "flex-start",
		marginTop: 20,
	},
	expandText: { color: "#655086", fontSize: 16, fontWeight: "800" },
	hint: {
		color: "#B4C0B8",
		fontSize: 14,
		textAlign: "center",
		lineHeight: 21,
		marginTop: 30,
		marginBottom: 18,
	},
	primary: {
		backgroundColor: "#B7F34A",
		minHeight: 58,
		borderRadius: 20,
		justifyContent: "center",
		alignItems: "center",
		padding: 16,
		marginTop: 8,
	},
	primaryText: {
		color: "#102019",
		fontSize: 17,
		fontWeight: "800",
		textAlign: "center",
	},
	pressed: { opacity: 0.8 },
	skipButton: {
		minHeight: 52,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 8,
	},
	centered: {
		flex: 1,
		justifyContent: "center",
		padding: 24,
		gap: 24,
		alignItems: "center",
	},
	finishedContent: {
		flexGrow: 1,
		justifyContent: "center",
		padding: 28,
		gap: 24,
		width: "100%",
		maxWidth: 520,
		alignSelf: "center",
	},
	title: {
		color: "#F6F7EF",
		fontSize: 34,
		fontWeight: "900",
		textAlign: "center",
	},
	summary: {
		backgroundColor: "#18271D",
		padding: 22,
		borderRadius: 24,
		gap: 12,
	},
	summaryText: { color: "#C1CBC4", fontSize: 17, textAlign: "center" },
});