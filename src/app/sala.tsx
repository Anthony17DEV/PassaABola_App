import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { socket } from '../services/socket';

export default function SalaMultiplayerScreen() {
	const [nome, setNome] = useState('');
	const [codigoSala, setCodigoSala] = useState('');
	const [salaAtiva, setSalaAtiva] = useState<any>(null);
	const [conectando, setConectando] = useState(false);

	useEffect(() => {
		// Quando o servidor avisar que alguém entrou ou saiu, atualiza a lista na tela
		socket.on('room_updated', (roomData) => {
			setSalaAtiva(roomData);
		});

		return () => {
			socket.off('room_updated');
			if (socket.connected) socket.disconnect(); // Desconecta se o cara fechar a tela
		};
	}, []);

	function conectarSocket() {
		if (!socket.connected) {
			socket.connect();
		}
	}

	function criarSala() {
		if (!nome.trim()) return Alert.alert('Ops', 'Digita teu nome primeiro!');
		Keyboard.dismiss();
		setConectando(true);
		conectarSocket();

		// Pede pro servidor criar a sala
		socket.emit('create_room', nome.trim(), (response: any) => {
			setConectando(false);
			if (response.success) {
				setSalaAtiva({ players: [{ name: nome.trim() }], state: 'lobby', code: response.roomCode });
			} else {
				Alert.alert('Erro', 'Não deu pra criar a sala agora.');
				socket.disconnect();
			}
		});
	}

	function entrarSala() {
		if (!nome.trim()) return Alert.alert('Ops', 'Digita teu nome primeiro!');
		if (!codigoSala.trim()) return Alert.alert('Ops', 'Digita o código da sala!');
		Keyboard.dismiss();
		setConectando(true);
		conectarSocket();

		// Tenta entrar na sala que o amigo passou
		socket.emit('join_room', { roomCode: codigoSala.trim().toUpperCase(), playerName: nome.trim() }, (response: any) => {
			setConectando(false);
			if (response.success) {
				setSalaAtiva(response.room);
			} else {
				Alert.alert('Não rolou', response.message);
				socket.disconnect();
			}
		});
	}

	function sairSala() {
		socket.disconnect();
		setSalaAtiva(null);
	}

	// TELA 2: DENTRO DA SALA (LOBBY)
	if (salaAtiva) {
		return (
			<SafeAreaView style={s.screen}>
				<View style={s.content}>
					<Pressable accessibilityRole="button" onPress={sairSala} style={s.back}>
						<Text style={s.backText}>← Sair da sala</Text>
					</Pressable>

					<Text style={s.eyebrow}>SALA MULTIPLAYER</Text>
					<Text style={s.title}>Código: <Text style={{ color: '#B7F34A' }}>{salaAtiva.code || codigoSala.toUpperCase()}</Text></Text>
					<Text style={s.description}>Passa esse código pra galera entrar na tua roda!</Text>

					<View style={s.playersList}>
						<Text style={s.label}>Na Roda ({salaAtiva.players?.length || 0}/15):</Text>
						{salaAtiva.players?.map((p: any, i: number) => (
							<View key={i} style={s.playerCard}>
								<Text style={s.playerName}>{p.name}</Text>
								{i === 0 && <Text style={s.hostTag}>HOST</Text>}
							</View>
						))}
					</View>

					<Pressable accessibilityRole="button" style={[s.start, { marginTop: 'auto' }]} onPress={() => Alert.alert('Bora!', 'Na próxima etapa, esse botão vai puxar o baralho e iniciar a partida.')}>
						<Text style={s.startText}>Começar Jogo ↗</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		);
	}

	// TELA 1: LOGIN (CRIAR OU ENTRAR)
	return (
		<SafeAreaView style={s.screen}>
			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
					<Pressable accessibilityRole="button" onPress={() => router.back()} style={s.back}>
						<Text style={s.backText}>← Voltar</Text>
					</Pressable>

					<Text style={s.eyebrow}>CARTAS MULTIPLAYER</Text>
					<Text style={s.title}>Entrar na roda.</Text>
					<Text style={s.description}>Cria uma sala pra ser o dono da mesa ou usa o código de um amigo.</Text>

					<Text style={s.label}>Teu Nome</Text>
					<TextInput value={nome} onChangeText={setNome} placeholder="Como a galera te chama?" placeholderTextColor="#82918A" style={s.input} maxLength={15} returnKeyType="done" />

					<Pressable accessibilityRole="button" onPress={criarSala} disabled={conectando} style={s.start}>
						<Text style={s.startText}>{conectando ? 'Conectando...' : 'Criar Nova Sala ↗'}</Text>
					</Pressable>

					<View style={s.dividerRow}>
						<View style={s.line} />
						<Text style={s.ou}>OU</Text>
						<View style={s.line} />
					</View>

					<Text style={s.label}>Código da Sala</Text>
					<TextInput value={codigoSala} onChangeText={setCodigoSala} placeholder="Ex: A1B2C3" placeholderTextColor="#82918A" style={s.input} autoCapitalize="characters" maxLength={6} returnKeyType="join" onSubmitEditing={entrarSala} />

					<Pressable accessibilityRole="button" onPress={entrarSala} disabled={conectando} style={[s.start, s.secondaryButton]}>
						<Text style={s.secondaryText}>{conectando ? 'Conectando...' : 'Entrar na Sala ↗'}</Text>
					</Pressable>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const s = StyleSheet.create({
	screen: { flex: 1, backgroundColor: '#0B140F' },
	content: { padding: 24, paddingBottom: 48, maxWidth: 620, width: '100%', alignSelf: 'center', flexGrow: 1 },
	back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: 28 },
	backText: { color: '#F6F7EF', fontSize: 16 },
	eyebrow: { color: '#BCA5F5', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
	title: { color: '#F6F7EF', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
	description: { color: '#B4C0B8', fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 30 },
	label: { color: '#F6F7EF', fontSize: 16, fontWeight: '700', marginBottom: 12 },
	input: { backgroundColor: '#142219', borderWidth: 1, borderColor: '#35453B', borderRadius: 16, padding: 14, minHeight: 56, color: '#F6F7EF', fontSize: 16, marginBottom: 24 },
	start: { minHeight: 60, backgroundColor: '#B7F34A', borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 16 },
	startText: { color: '#102019', fontSize: 17, fontWeight: '800', textAlign: 'center' },
	secondaryButton: { backgroundColor: '#142219', borderColor: '#35453B', borderWidth: 1 },
	secondaryText: { color: '#B7F34A', fontSize: 17, fontWeight: '800', textAlign: 'center' },
	dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 32 },
	line: { flex: 1, height: 1, backgroundColor: '#2B3D31' },
	ou: { color: '#82918A', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
	playersList: { marginTop: 10, gap: 12 },
	playerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#18271D', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#2B3D31' },
	playerName: { color: '#E3EAE4', fontSize: 18, fontWeight: '800' },
	hostTag: { backgroundColor: '#302844', color: '#BCA5F5', fontSize: 10, fontWeight: '900', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
});