import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { socket } from '../services/socket';

export default function SalaMultiplayerScreen() {
	const [nome, setNome] = useState('');
	const [codigoSala, setCodigoSala] = useState('');
	const [salaAtiva, setSalaAtiva] = useState<any>(null);
	const [conectando, setConectando] = useState(false);

	useEffect(() => {
		socket.on('room_updated', (roomData) => {
			setSalaAtiva(roomData);
		});

		return () => {
			socket.off('room_updated');
			if (socket.connected) socket.disconnect();
		};
	}, []);

	function conectarSocket() {
		if (!socket.connected) socket.connect();
	}

	function criarSala() {
		if (!nome.trim()) return Alert.alert('Ops', 'Digita teu nome primeiro!');
		Keyboard.dismiss(); setConectando(true); conectarSocket();

		socket.emit('create_room', nome.trim(), (response: any) => {
			setConectando(false);
			if (response?.success) {
				setSalaAtiva({ code: response.roomCode, state: 'lobby', players: [{ id: socket.id, name: nome.trim(), score: 0 }] });
			} else {
				Alert.alert('Erro', 'Não deu pra criar a sala agora.');
				socket.disconnect();
			}
		});
	}

	function entrarSala() {
		if (!nome.trim()) return Alert.alert('Ops', 'Digita teu nome primeiro!');
		if (!codigoSala.trim()) return Alert.alert('Ops', 'Digita o código da sala!');
		Keyboard.dismiss(); setConectando(true); conectarSocket();

		socket.emit('join_room', { roomCode: codigoSala.trim().toUpperCase(), playerName: nome.trim() }, (response: any) => {
			setConectando(false);
			if (response?.success) setSalaAtiva(response.room);
			else { Alert.alert('Não rolou', response?.message || 'Erro ao entrar'); socket.disconnect(); }
		});
	}

	function sairSala() {
		socket.disconnect(); setSalaAtiva(null);
	}

	function iniciarJogo() {
		const players = salaAtiva?.players || [];
		if (players.length < 2) return Alert.alert('Calma aí', 'Precisamos de pelo menos 2 jogadores pra começar!');
		socket.emit('start_game', salaAtiva?.code);
	}

	function handleWhiteCardClick(cardText: string, isCzar: boolean, me: any) {
		if (isCzar) return Alert.alert('Tu é o Juiz!', 'Juiz não joga carta branca, só julga a dos outros.');
		if (me?.hasPlayed) return Alert.alert('Calma', 'Tu já jogou nesta rodada. Espera a galera!');

		Alert.alert(
			"Ação da Carta",
			"O que tu quer fazer com essa carta?",
			[
				{ text: "Jogar na mesa", onPress: () => socket.emit('play_card', { roomCode: salaAtiva?.code, cardText }) },
				{ text: "Descartar e puxar outra", onPress: () => socket.emit('discard_white', { roomCode: salaAtiva?.code, cardText }) },
				{ text: "Cancelar", style: "cancel" }
			]
		);
	}

	function handleBlackCardClick(isCzar: boolean) {
		if (!isCzar || salaAtiva?.state !== 'playing') return;
		Alert.alert("Carta ruim?", "Quer trocar essa carta preta por outra?", [
			{ text: "Trocar", onPress: () => socket.emit('discard_black', salaAtiva?.code) },
			{ text: "Deixa essa", style: "cancel" }
		]);
	}

	function handleJudgeCard(cardText: string, isCzar: boolean) {
		if (!isCzar) return Alert.alert('Aviso', 'Apenas o Juiz (⚖️) pode escolher a carta vencedora.');
		if (salaAtiva?.state !== 'judging') return Alert.alert('Aviso', 'Aguarde todos jogarem as cartas brancas primeiro.');

		Alert.alert("Escolher essa?", "Dar o ponto pra essa resposta?", [
			{ text: "É a melhor!", onPress: () => socket.emit('choose_winner', { roomCode: salaAtiva?.code, cardText }) },
			{ text: "Pensar mais", style: "cancel" }
		]);
	}

	if (salaAtiva && salaAtiva.state) {
		const players = salaAtiva.players || [];
		const isHost = players[0]?.id === socket.id;
		const me = players.find((p: any) => p.id === socket.id);
		const czar = players[salaAtiva.czarIndex || 0];
		const isCzar = czar?.id === socket.id;
		const roomCode = salaAtiva.code || codigoSala.toUpperCase();
		const cardsOnTable = salaAtiva.cardsOnTable || [];

		if (salaAtiva.state === 'lobby') {
			return (
				<SafeAreaView style={s.screen}>
					<View style={s.content}>
						<Pressable accessibilityRole="button" onPress={sairSala} style={s.back}><Text style={s.backText}>← Sair</Text></Pressable>
						<Text style={s.eyebrow}>SALA MULTIPLAYER</Text>
						<Text style={s.title}>Código: <Text style={{ color: '#B7F34A' }}>{roomCode}</Text></Text>
						<Text style={s.description}>Passa esse código pra galera entrar na tua roda!</Text>

						<ScrollView style={s.playersList}>
							<Text style={s.label}>Na Roda ({players.length}/15):</Text>
							{players.map((p: any, i: number) => (
								<View key={i} style={s.playerCard}>
									<Text style={s.playerName}>{p.name}</Text>
									{i === 0 && <Text style={s.hostTag}>HOST</Text>}
								</View>
							))}
						</ScrollView>

						{isHost ? (
							<TouchableOpacity activeOpacity={0.8} style={[s.start, { marginTop: 20 }]} onPress={iniciarJogo}>
								<Text style={s.startText}>Começar Jogo ↗</Text>
							</TouchableOpacity>
						) : (
							<Text style={s.waitingText}>Esperando o Host começar o jogo...</Text>
						)}
					</View>
				</SafeAreaView>
			);
		}

		if (salaAtiva.state === 'playing' || salaAtiva.state === 'judging') {
			return (
				<SafeAreaView style={s.screen}>
					<View style={s.header}>
						<Text style={s.roomCodeMini}>SALA: {roomCode}</Text>
						<ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.scoreBoard}>
							{players.map((p: any, i: number) => (
								<View key={i} style={s.scorePill}>
									<Text style={[s.scoreName, p.id === czar?.id && { color: '#BCA5F5' }]}>{p.name} {p.id === czar?.id && '⚖️'}</Text>
									<Text style={s.scorePoints}>{p.score || 0}</Text>
								</View>
							))}
						</ScrollView>
					</View>

					<ScrollView contentContainerStyle={s.playArea} keyboardShouldPersistTaps="handled">
						{isCzar ? (
							<Text style={s.turnAlert}>Tu é o Juiz! ⚖️</Text>
						) : (
							<Text style={s.turnAlert}>Juiz da rodada: {czar?.name}</Text>
						)}

						<TouchableOpacity activeOpacity={0.8} onPress={() => handleBlackCardClick(isCzar)} style={s.blackCard}>
							<Text style={s.blackCardText}>{salaAtiva.currentBlackCard}</Text>
							{isCzar && salaAtiva.state === 'playing' && <Text style={s.hintText}>Toque para trocar a carta preta</Text>}
						</TouchableOpacity>

						<View style={s.tableArea}>
							<Text style={s.label}>Cartas na Mesa</Text>
							{salaAtiva.state === 'playing' ? (
								<Text style={s.tableStatus}>{cardsOnTable.length} de {Math.max(0, players.length - 1)} jogaram.</Text>
							) : (
								<View style={s.cardsGrid}>
									{cardsOnTable.map((c: any, i: number) => (
										<TouchableOpacity
											key={i}
											activeOpacity={0.7}
											onPress={() => handleJudgeCard(c.card, isCzar)}
											style={s.whiteCardOnTable}
										>
											<Text style={s.whiteCardText}>{c.card}</Text>
											{isCzar && <Text style={s.hintDark}>Toque para escolher</Text>}
										</TouchableOpacity>
									))}
								</View>
							)}
						</View>

						{!isCzar && (
							<View style={s.handArea}>
								<Text style={s.label}>Tua Mão {me?.hasPlayed && '(Aguardando...)'}</Text>
								<ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
									{me?.hand?.map((cardText: string, i: number) => (
										<TouchableOpacity
											key={i}
											activeOpacity={0.7}
											onPress={() => handleWhiteCardClick(cardText, isCzar, me)}
											style={[s.whiteCardHand, me?.hasPlayed && { opacity: 0.5 }]}
										>
											<Text style={s.whiteCardText}>{cardText}</Text>
										</TouchableOpacity>
									))}
								</ScrollView>
							</View>
						)}
					</ScrollView>
				</SafeAreaView>
			);
		}

		if (salaAtiva.state === 'round_end') {
			return (
				<SafeAreaView style={s.screen}>
					<View style={s.centeredContent}>
						<Text style={s.eyebrow}>FIM DA RODADA</Text>
						<Text style={s.title}>{salaAtiva.winnerName} Ganhou! 🎉</Text>

						<View style={[s.blackCard, { marginTop: 30, opacity: 0.9 }]}>
							<Text style={s.blackCardText}>{salaAtiva.currentBlackCard}</Text>
						</View>
						<View style={[s.whiteCardOnTable, { marginTop: -20, alignSelf: 'center', zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, elevation: 10 }]}>
							<Text style={s.whiteCardText}>{salaAtiva.winningCard}</Text>
						</View>

						{isHost && (
							<TouchableOpacity activeOpacity={0.8} style={[s.start, { marginTop: 40 }]} onPress={() => socket.emit('next_round', salaAtiva.code)}>
								<Text style={s.startText}>Próxima Rodada ↗</Text>
							</TouchableOpacity>
						)}
						{!isHost && <Text style={[s.waitingText, { marginTop: 40 }]}>Esperando o Host puxar a próxima...</Text>}
					</View>
				</SafeAreaView>
			);
		}

		if (salaAtiva.state === 'game_over') {
			return (
				<SafeAreaView style={s.screen}>
					<View style={s.centeredContent}>
						<Text style={s.eyebrow}>ACABOU A BRINCADEIRA</Text>
						<Text style={s.title}>👑 {salaAtiva.winnerName} mitou e fez {salaAtiva.players?.find((p: any) => p.name === salaAtiva.winnerName)?.score || 20} pontos!</Text>
						<TouchableOpacity activeOpacity={0.8} style={[s.start, { marginTop: 40 }]} onPress={sairSala}>
							<Text style={s.startText}>Sair da Sala ↗</Text>
						</TouchableOpacity>
					</View>
				</SafeAreaView>
			);
		}
	}

	return (
		<SafeAreaView style={s.screen}>
			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
					<Pressable accessibilityRole="button" onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Voltar</Text></Pressable>
					<Text style={s.eyebrow}>CARTAS NA MESA</Text>
					<Text style={s.title}>Entrar na roda.</Text>
					<Text style={s.description}>Cria uma sala pra ser o dono da mesa ou usa o código de um amigo.</Text>
					<Text style={s.label}>Teu Nome</Text>
					<TextInput value={nome} onChangeText={setNome} placeholder="Como a galera te chama?" placeholderTextColor="#82918A" style={s.input} maxLength={15} returnKeyType="done" />
					<TouchableOpacity activeOpacity={0.8} onPress={criarSala} disabled={conectando} style={s.start}>
						<Text style={s.startText}>{conectando ? 'Conectando...' : 'Criar Nova Sala ↗'}</Text>
					</TouchableOpacity>
					<View style={s.dividerRow}>
						<View style={s.line} /><Text style={s.ou}>OU</Text><View style={s.line} />
					</View>
					<Text style={s.label}>Código da Sala</Text>
					<TextInput value={codigoSala} onChangeText={setCodigoSala} placeholder="Ex: A1B2C3" placeholderTextColor="#82918A" style={s.input} autoCapitalize="characters" maxLength={6} returnKeyType="join" onSubmitEditing={entrarSala} />
					<TouchableOpacity activeOpacity={0.8} onPress={entrarSala} disabled={conectando} style={[s.start, s.secondaryButton]}>
						<Text style={s.secondaryText}>{conectando ? 'Conectando...' : 'Entrar na Sala ↗'}</Text>
					</TouchableOpacity>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const PONTOS_MAXIMOS = 20;

const s = StyleSheet.create({
	screen: { flex: 1, backgroundColor: '#0B140F' },
	content: { padding: 24, paddingBottom: 48, maxWidth: 620, width: '100%', alignSelf: 'center', flexGrow: 1 },
	centeredContent: { padding: 24, flex: 1, justifyContent: 'center', alignItems: 'center' },
	back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: 28 },
	backText: { color: '#F6F7EF', fontSize: 16 },
	eyebrow: { color: '#BCA5F5', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
	title: { color: '#F6F7EF', fontSize: 36, fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
	description: { color: '#B4C0B8', fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 30 },
	label: { color: '#F6F7EF', fontSize: 16, fontWeight: '700', marginBottom: 12 },
	input: { backgroundColor: '#142219', borderWidth: 1, borderColor: '#35453B', borderRadius: 16, padding: 14, minHeight: 56, color: '#F6F7EF', fontSize: 16, marginBottom: 24 },
	start: { minHeight: 60, backgroundColor: '#B7F34A', borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 16, width: '100%' },
	startText: { color: '#102019', fontSize: 17, fontWeight: '800', textAlign: 'center' },
	secondaryButton: { backgroundColor: '#142219', borderColor: '#35453B', borderWidth: 1 },
	secondaryText: { color: '#B7F34A', fontSize: 17, fontWeight: '800', textAlign: 'center' },
	dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 32 },
	line: { flex: 1, height: 1, backgroundColor: '#2B3D31' },
	ou: { color: '#82918A', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
	playersList: { marginTop: 10, flex: 1 },
	playerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#18271D', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#2B3D31', marginBottom: 10 },
	playerName: { color: '#E3EAE4', fontSize: 18, fontWeight: '800' },
	hostTag: { backgroundColor: '#302844', color: '#BCA5F5', fontSize: 10, fontWeight: '900', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
	waitingText: { color: '#82918A', fontSize: 16, textAlign: 'center', marginTop: 20 },

	// ESTILOS DE JOGO
	header: { backgroundColor: '#142219', padding: 16, paddingTop: Platform.OS === 'ios' ? 0 : 16, borderBottomWidth: 1, borderColor: '#2B3D31' },
	roomCodeMini: { color: '#B7F34A', fontSize: 12, fontWeight: '900', marginBottom: 10, letterSpacing: 1 },
	scoreBoard: { flexDirection: 'row' },
	scorePill: { backgroundColor: '#0B140F', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, marginRight: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#35453B' },
	scoreName: { color: '#B4C0B8', fontSize: 14, fontWeight: '700', marginRight: 8 },
	scorePoints: { color: '#F6F7EF', fontSize: 16, fontWeight: '900' },
	playArea: { padding: 20, paddingBottom: 60 },
	turnAlert: { color: '#F6F7EF', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 20 },

	blackCard: { backgroundColor: '#111', padding: 24, borderRadius: 16, minHeight: 220, justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 5 },
	blackCardText: { color: '#FFF', fontSize: 24, fontWeight: '800', lineHeight: 32 },
	hintText: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 20 },
	hintDark: { color: '#999', fontSize: 12, textAlign: 'center', marginTop: 20 },
	tableArea: { marginTop: 30, minHeight: 150 },
	tableStatus: { color: '#82918A', fontSize: 16, fontStyle: 'italic' },
	cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
	whiteCardOnTable: { backgroundColor: '#F1EEDC', padding: 16, borderRadius: 12, width: '48%', minHeight: 140, justifyContent: 'space-between' },
	whiteCardHand: { backgroundColor: '#F1EEDC', padding: 16, borderRadius: 12, width: 160, minHeight: 200, marginRight: 12, justifyContent: 'flex-start' },
	whiteCardText: { color: '#111', fontSize: 16, fontWeight: '700' },
	handArea: { marginTop: 40 },
});