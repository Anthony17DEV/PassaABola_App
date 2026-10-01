import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function JogadoresScreen() {
	const params = useLocalSearchParams();
	const [name, setName] = useState('');
	const [players, setPlayers] = useState<string[]>([]);

	function addPlayer() {
		const newName = name.trim();
		if (!newName) return;

		if (players.map(p => p.toLowerCase()).includes(newName.toLowerCase())) {
			Alert.alert('Nome repetido', 'Esse jogador já está na roda!');
			return;
		}

		if (players.length >= 15) {
			Alert.alert('Roda cheia', 'O limite é de 15 jogadores por sessão.');
			return;
		}

		setPlayers([...players, newName]);
		setName('');
	}

	function removePlayer(indexToRemove: number) {
		setPlayers(players.filter((_, index) => index !== indexToRemove));
	}

	function startGroupSession() {
		if (players.length < 2) {
			Alert.alert('Faltou gente', 'Adicione pelo menos 2 jogadores para começar a resenha.');
			return;
		}

		Keyboard.dismiss();

		router.push({
			pathname: '/jogar',
			params: {
				...params,
				jogadores: JSON.stringify(players),
			},
		});
	}

	return (
		<SafeAreaView style={s.screen}>
			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
					<Pressable accessibilityRole="button" onPress={() => router.back()} style={s.back}>
						<Text style={s.backText}>← Voltar</Text>
					</Pressable>

					<Text style={s.eyebrow}>QUEM TÁ NA RODA?</Text>
					<Text accessibilityRole="header" style={s.title}>Bora passar a bola.</Text>
					<Text style={s.description}>Adiciona a galera que vai jogar. Pelo menos duas pessoas.</Text>

					<View style={s.inputRow}>
						<TextInput
							accessibilityLabel="Nome do jogador"
							value={name}
							onChangeText={setName}
							placeholder="Ex: João, Maria..."
							placeholderTextColor="#82918A"
							style={s.input}
							maxLength={20}
							returnKeyType="done"
							onSubmitEditing={addPlayer}
						/>
						<Pressable
							accessibilityRole="button"
							disabled={!name.trim()}
							onPress={addPlayer}
							style={[s.add, !name.trim() && { opacity: 0.4 }]}
						>
							<Text style={s.addText}>+</Text>
						</Pressable>
					</View>

					<View style={s.playersList}>
						{players.length === 0 ? (
							<Text style={s.emptyText}>Ninguém na roda ainda.</Text>
						) : (
							players.map((player, index) => (
								<View key={index} style={s.playerCard}>
									<Text style={s.playerName}>{player}</Text>
									<Pressable onPress={() => removePlayer(index)} style={s.removeButton}>
										<Text style={s.removeText}>✕</Text>
									</Pressable>
								</View>
							))
						)}
					</View>
				</ScrollView>

				<View style={s.footer}>
					<Pressable
						accessibilityRole="button"
						onPress={startGroupSession}
						style={({ pressed }) => [
							s.start,
							players.length < 2 && s.startDisabled,
							pressed && players.length >= 2 && { opacity: 0.8 }
						]}
					>
						<Text style={[s.startText, players.length < 2 && s.startTextDisabled]}>
							Começar resenha ↗
						</Text>
					</Pressable>
				</View>
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
	inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 30 },
	input: { flex: 1, backgroundColor: '#142219', borderWidth: 1, borderColor: '#35453B', borderRadius: 16, padding: 14, minHeight: 56, color: '#F6F7EF', fontSize: 16 },
	add: { width: 56, height: 56, backgroundColor: '#BCA5F5', alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
	addText: { color: '#211E30', fontWeight: '900', fontSize: 28 },
	playersList: { gap: 12 },
	emptyText: { color: '#82918A', fontSize: 15, textAlign: 'center', marginTop: 20 },
	playerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#18271D', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#2B3D31' },
	playerName: { color: '#E3EAE4', fontSize: 16, fontWeight: '700' },
	removeButton: { padding: 8, margin: -8 },
	removeText: { color: '#82918A', fontSize: 16, fontWeight: '900' },
	footer: { padding: 24, paddingBottom: 34, backgroundColor: '#0B140F' },
	start: { minHeight: 60, backgroundColor: '#B7F34A', borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 16 },
	startDisabled: { backgroundColor: '#142219', borderWidth: 1, borderColor: '#35453B' },
	startText: { color: '#102019', fontSize: 17, fontWeight: '800', textAlign: 'center' },
	startTextDisabled: { color: '#82918A' },
});