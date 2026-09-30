import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MOODS = [
  "Dar risada",
  "Relaxar",
  "Viajar nas ideias",
  "Me surpreender",
  "Papo profundo",
];

const FORMATS = [
  { id: "surpresa", label: "Me surpreende" },
  { id: "filme", label: "Filmes" }, { id: "serie", label: "Séries" },
  { id: "musica", label: "Músicas" }, { id: "video", label: "Vídeos" },
];

const TOPICS = [
  "Espaço",
  "Natureza",
  "Música",
  "Games",
  "Nostalgia",
  "Mistérios",
  "Relacionamentos",
  "Assuntos absurdos",
];

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function VibeScreen() {
  const params = useLocalSearchParams<{
    sessao?: string | string[];
    modo?: string | string[];
    titulo?: string | string[];
  }>();

  const modeTitle = Array.isArray(params.titulo)
    ? params.titulo[0]
    : params.titulo;
  const [mood, setMood] = useState("Dar risada");
  const [topics, setTopics] = useState<string[]>([]);
  const [format, setFormat] = useState("surpresa");

  const modeId = Array.isArray(params.modo) ? params.modo[0] : params.modo;

  const session = Array.isArray(params.sessao) ? params.sessao[0] : params.sessao;
  const recommendations = modeId === "recomendacoes";
  const canStart = modeId === "brisa-solo" || modeId === "desafios-solo" || modeId === "papo" || (recommendations && session !== "amigos");

  function startSession() {
    if (!canStart || !modeId) return;

    router.push({
      pathname: recommendations ? "/recomendacoes" : "/jogar",
      params: {
        modo: modeId,
        formato: format,
        mood,
        temas: JSON.stringify(topics),
      },
    });
  }

  function toggleTopic(topic: string) {
    setTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic],
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para os modos"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
          style={styles.back}
        >
          <Text style={styles.backText}>← Voltar</Text>
        </Pressable>

        <Text style={styles.eyebrow}>
          {modeTitle ? modeTitle.toUpperCase() : "DO SEU JEITO"}
        </Text>
        <Text accessibilityRole="header" style={styles.title}>
          Qual é a vibe{"\n"}de hoje?
        </Text>
        <Text style={styles.description}>
          Escolhe o clima e os assuntos que combinam contigo.
        </Text>

        {recommendations && (
          <>
            <Text style={styles.label}>O que tu quer curtir?</Text>
            <View style={styles.chips}>
              {FORMATS.map(item => <Chip key={item.id} label={item.label} selected={format === item.id} onPress={() => setFormat(item.id)} />)}
            </View>
          </>
        )}

        <Text style={styles.label}>Quero...</Text>
        <View style={styles.chips}>
          {MOODS.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={mood === item}
              onPress={() => setMood(item)}
            />
          ))}
        </View>

        <Text style={styles.label}>{recommendations ? "Me interesso por..." : modeId === "desafios-solo" ? "Quero desafios sobre..." : "Curto falar sobre..."}</Text>
        <Text style={styles.hint}>
          Pode marcar vários. Nenhum marcado? Vale tudo.
        </Text>
        <View style={styles.chips}>
          {TOPICS.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={topics.includes(item)}
              onPress={() => toggleTopic(item)}
            />
          ))}
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>SUA VIBE</Text>
          <Text style={styles.summaryTitle}>{mood}</Text>
          <Text style={styles.description}>
            {topics.length ? topics.join(" • ") : "Todos os temas"}
          </Text>
        </View>
          {canStart && (
            <Pressable
              accessibilityRole="button"
              onPress={startSession}
              style={({ pressed }) => [
                styles.startButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.startButtonText}>Bora começar ↗</Text>
            </Pressable>
          )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B140F" },
  content: { padding: 24, paddingBottom: 48 },
  back: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 28,
  },
  backText: { color: "#F6F7EF", fontSize: 16 },
  eyebrow: {
    color: "#BCA5F5",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
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
    marginTop: 12,
  },
  label: {
    color: "#F6F7EF",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 32,
    marginBottom: 12,
  },
  hint: {
    color: "#B4C0B8",
    fontSize: 14,
    marginBottom: 14,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#35453B",
    backgroundColor: "#142219",
  },
  chipSelected: {
    backgroundColor: "#B7F34A",
    borderColor: "#B7F34A",
  },
  chipText: { color: "#E3EAE4", fontSize: 15, fontWeight: "600" },
  chipTextSelected: { color: "#102019" },
  summary: {
    marginTop: 32,
    padding: 22,
    borderRadius: 24,
    backgroundColor: "#19271F",
  },
  summaryLabel: {
    color: "#BCA5F5",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  summaryTitle: {
    color: "#F6F7EF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 10,
  },
  startButton: {
    minHeight: 60,
    backgroundColor: "#B7F34A",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginTop: 24,
  },
  startButtonText: {
    color: "#102019",
    fontSize: 18,
    fontWeight: "800",
  },
});
