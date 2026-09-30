import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Mode = {
  id: string;
  emoji: string;
  title: string;
  description: string;
};

const SOLO_MODES: Mode[] = [
  {
    id: "brisa-solo",
    emoji: "🪐",
    title: "Brisa solo",
    description: "Perguntas curiosas e ideias pra tua mente passear.",
  },
  {
    id: "desafios-solo",
    emoji: "🎭",
    title: "Desafios solo",
    description: "Improviso e criatividade pra sair do automático.",
  },
  {
    id: "recomendacoes",
    emoji: "🎧",
    title: "Recomendações",
    description: "Encontra um filme, uma série, um vídeo ou um som.",
  },
];

const FRIENDS_MODES: Mode[] = [
  {
    id: "papo",
    emoji: "💬",
    title: "Papo com a galera",
    description: "Assuntos que começam do nada e rendem a noite inteira.",
  },
  {
    id: "passa-a-bola",
    emoji: "🔄",
    title: "Passa a bola",
    description: "Cada um tem sua vez. Perguntas e desafios entram na roda.",
  },
  {
    id: "quem-da-roda",
    emoji: "👀",
    title: "Quem da roda?",
    description: "Quem combina com a situação? A galera decide.",
  },
  {
    id: "missoes",
    emoji: "🎭",
    title: "Missões da resenha",
    description: "Desafios coletivos de improviso e criatividade.",
  },
  {
    id: "recomendacoes",
    emoji: "🍿",
    title: "Recomendações",
    description: "Escolham algo pra assistir ou ouvir juntos.",
  },
];

export default function ModesScreen() {
  const params = useLocalSearchParams<{
    sessao?: string | string[];
  }>();

  const rawSession = Array.isArray(params.sessao)
    ? params.sessao[0]
    : params.sessao;

  const session = rawSession === "amigos" ? "amigos" : "solo";
  const isSolo = session === "solo";
  const modes = isSolo ? SOLO_MODES : FRIENDS_MODES;
  const accent = isSolo ? "#B7F34A" : "#BCA5F5";

  function selectMode(mode: Mode) {
    router.push({
      pathname: "/vibe",
      params: {
        sessao: session,
        modo: mode.id,
        titulo: mode.title,
      },
    });
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/sessao");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={styles.back}
        >
          <Text style={styles.backText}>← Voltar</Text>
        </Pressable>

        <Text style={[styles.eyebrow, { color: accent }]}>
          {isSolo ? "SESSÃO SOLO" : "SESSÃO COM AMIGOS"}
        </Text>

        <Text accessibilityRole="header" style={styles.title}>
          {isSolo ? "O que tu quer\ncurtir agora?" : "Qual vai ser\na da vez?"}
        </Text>

        <Text style={styles.description}>
          Escolhe o modo. Depois a gente acerta a vibe.
        </Text>

        <View style={styles.cards}>
          {modes.map((mode) => (
            <Pressable
              key={mode.id}
              accessibilityRole="button"
              accessibilityLabel={mode.title}
              onPress={() => selectMode(mode)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.cardTop}>
                <Text accessible={false} style={styles.emoji}>
                  {mode.emoji}
                </Text>

                <Text
                  accessible={false}
                  style={[styles.arrow, { color: accent }]}
                >
                  ↗
                </Text>
              </View>

              <Text style={styles.cardTitle}>{mode.title}</Text>

              <Text style={styles.cardDescription}>{mode.description}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B140F",
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  back: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 24,
  },
  backText: {
    color: "#F6F7EF",
    fontSize: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: "#F6F7EF",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1,
  },
  description: {
    color: "#B4C0B8",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
  },
  cards: {
    gap: 14,
    marginTop: 28,
  },
  card: {
    backgroundColor: "#142219",
    borderColor: "#304238",
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  emoji: {
    fontSize: 28,
  },
  arrow: {
    fontSize: 26,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#F6F7EF",
    fontSize: 22,
    fontWeight: "800",
  },
  cardDescription: {
    color: "#B4C0B8",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
});
