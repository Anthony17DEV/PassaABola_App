import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import BrandLogo from "../components/brand-logo";
import type { ConversationCard } from "../types/ai";
import { requestCards } from "../services/ai";

type Param = string | string[] | undefined;

type Phase =
  | "shuffling"
  | "dealing"
  | "hidden"
  | "flipping"
  | "revealed"
  | "discarding"
  | "finished";

type GameState = {
  phase: Phase;
  index: number;
  answered: number;
  skipped: number;
  expanded: boolean;
  skipCurrent: boolean;
};

type GameProps = {
  mode: string;
  mood: string;
  topics: string[];
};

function first(value: Param): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function readTopics(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export default function PlayScreen() {
  const params = useLocalSearchParams<{
    modo?: Param;
    mood?: Param;
    temas?: Param;
  }>();

  const mode = first(params.modo);
  const mood = first(params.mood);
  const topicsRaw = first(params.temas);

  return (
    <CardSession
      key={JSON.stringify([mode, mood, topicsRaw])}
      mode={mode}
      mood={mood}
      topics={readTopics(topicsRaw)}
    />
  );
}

function CardSession({ mode, mood, topics }: GameProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const supported = ["brisa-solo", "desafios-solo", "papo"].includes(mode);
  const isChallenge = mode === "desafios-solo";
  const isGroup = mode === "papo";
  const title = isGroup ? "Papo com a galera" : isChallenge ? "Desafios solo" : "Brisa solo";

  const [deck, setDeck] = useState<ConversationCard[]>([]);
  const [isGenerating, setIsGenerating] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const historyRef = useRef<string[]>([]);
  const topicsKey = JSON.stringify(topics);

  const [game, setGame] = useState<GameState>({
    phase: "shuffling",
    index: 0,
    answered: 0,
    skipped: 0,
    expanded: false,
    skipCurrent: false,
  });

  const shuffle = useRef(new Animated.Value(0)).current;
  const flip = useRef(new Animated.Value(0)).current;
  const travel = useRef(new Animated.Value(0)).current;
  const arrival = useRef(new Animated.Value(1)).current;

  const card = deck[game.index];
  const cardHeight = Math.max(360, Math.min(height * 0.55, 500));

  const revealed = game.phase === "revealed";
  const hidden = game.phase === "hidden";
  const shuffling = game.phase === "shuffling";

  const fetchCards = useCallback(async () => {
    if (!supported || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const newCards = await requestCards({
        mode, mood, topics: JSON.parse(topicsKey) as string[],
        exclude: historyRef.current.slice(-30),
      }, controller.signal);
      if (controller.signal.aborted) return;
      historyRef.current = [...historyRef.current, ...newCards.map(c => c.question)].slice(-30);
      // Cada lote começa em zero: não retoma cartas antigas ao encerrar cedo.
      flip.setValue(0);
      travel.setValue(0);
      arrival.setValue(1);
      shuffle.setValue(0);
      setDeck(newCards);
      setGame({ phase: "shuffling", index: 0, answered: 0, skipped: 0, expanded: false, skipCurrent: false });
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível gerar. Tente novamente.");
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsGenerating(false);
      }
    }
  }, [supported, mode, mood, topicsKey, flip, travel, arrival, shuffle]);

  useEffect(() => {
    void fetchCards();
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [fetchCards]);

  useEffect(() => {
    if (!supported || deck.length === 0 || isGenerating || errorMessage) return;

    let active = true;
    let animation: Animated.CompositeAnimation | undefined;

    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, {
        toValue,
        duration: reduceMotion ? 0 : duration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      });

    if (game.phase === "shuffling") {
      shuffle.setValue(0);

      animation = Animated.sequence([
        timing(shuffle, 1, 220),
        timing(shuffle, -1, 300),
        timing(shuffle, 1, 300),
        timing(shuffle, -1, 300),
        timing(shuffle, 0, 220),
      ]);

      animation.start(({ finished }) => {
        if (!finished || !active) return;
        setGame((current) => ({ ...current, phase: "dealing" }));
      });
    }

    if (game.phase === "dealing") {
      flip.setValue(0);
      travel.setValue(0);
      arrival.setValue(0);

      animation = timing(arrival, 1, 320);

      animation.start(({ finished }) => {
        if (!finished || !active) return;
        setGame((current) => ({ ...current, phase: "hidden" }));
      });
    }

    if (game.phase === "flipping") {
      animation = timing(flip, 1, 520);

      animation.start(({ finished }) => {
        if (!finished || !active) return;
        setGame((current) => ({ ...current, phase: "revealed" }));
      });
    }

    if (game.phase === "discarding") {
      const destination = game.skipCurrent ? -width * 1.3 : width * 1.3;
      animation = timing(travel, destination, 340);

      animation.start(({ finished }) => {
        if (!finished || !active) return;

        setGame((current) => {
          const nextIndex = current.index + 1;
          return {
            phase: nextIndex >= deck.length ? "finished" : "dealing",
            index: nextIndex,
            answered: current.answered + (current.skipCurrent ? 0 : 1),
            skipped: current.skipped + (current.skipCurrent ? 1 : 0),
            expanded: false,
            skipCurrent: false,
          };
        });
      });
    }

    return () => {
      active = false;
      animation?.stop();
    };
  }, [
    game.phase,
    game.skipCurrent,
    supported,
    deck.length,
    isGenerating,
    errorMessage,
    reduceMotion,
    width,
    shuffle,
    flip,
    travel,
    arrival,
  ]);

  function returnToSettings() {
    requestRef.current?.abort();
    requestRef.current = null;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/sessao");
    }
  }

  function revealCard() {
    setGame((current) =>
      current.phase === "hidden" ? { ...current, phase: "flipping" } : current,
    );
  }

  function discardCard(skip: boolean) {
    setGame((current) =>
      current.phase === "revealed"
        ? { ...current, phase: "discarding", skipCurrent: skip }
        : current,
    );
  }

  function finishSession() {
    setGame((current) => ({ ...current, phase: "finished" }));
  }

  if (!supported) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.title}>Esse modo ainda não está disponível.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={returnToSettings}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Voltar às escolhas</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isGenerating) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#B7F34A" />
          <Text style={styles.title}>Criando a vibe perfeita...</Text>
          <Text style={styles.mutedText}>
            Conectando e criando cinco cartas. O primeiro acesso pode levar até dois minutos.
          </Text>
          <Pressable accessibilityRole="button" onPress={returnToSettings} style={styles.skipButton}>
            <Text style={styles.mutedText}>Cancelar e voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.title}>Não deu pra gerar agora</Text>
          <Text style={styles.mutedText}>{errorMessage}</Text>
          <Pressable accessibilityRole="button" onPress={() => void fetchCards()} style={styles.primary}>
            <Text style={styles.primaryText}>Tentar novamente</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={returnToSettings} style={styles.skipButton}>
            <Text style={styles.mutedText}>Voltar às escolhas</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (game.phase === "finished") {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.finishedContent}>
          <BrandLogo size={84} />

          <Text style={styles.eyebrow}>SESSÃO ENCERRADA</Text>

          <Text accessibilityRole="header" style={styles.title}>
            {isGroup ? "Rendeu assunto?" : isChallenge ? "Curtiu os desafios?" : "Deu uma viajada?"}
          </Text>

          <View style={styles.summary}>
            <Text style={styles.summaryText}>Resumo deste lote</Text>
            <Text style={styles.summaryText}>
              {game.answered} carta(s) concluída(s)
            </Text>
            <Text style={styles.summaryText}>
              {game.skipped} carta(s) pulada(s)
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => void fetchCards()}
            disabled={isGenerating}
            style={[styles.primary, isGenerating && styles.pressed]}
          >
            <Text style={styles.primaryText}>
              {isGenerating ? "Gerando..." : "Gerar mais cartas"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={returnToSettings}
            style={styles.skipButton}
          >
            <Text style={styles.mutedText}>Mudar a vibe da sessão</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!card) return null;

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

        <Text style={styles.eyebrow}>
          {mood.toUpperCase() || "DO SEU JEITO"}
        </Text>

        <View style={styles.progressRow}>
          <Text style={styles.mutedText}>
            Carta {game.index + 1} de {deck.length}
          </Text>

          <Text style={styles.smallText}>Gerado por IA</Text>
        </View>

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
                  <Text style={styles.backCaption}>UMA IDEIA POR VEZ</Text>
                </View>
                <Text style={styles.touchHint}>Toque para revelar ↗</Text>
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
                    {String(game.index + 1).padStart(2, "0")}
                  </Text>
                </View>

                <Text style={styles.question}>{card.question}</Text>

                {game.expanded && (
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
                    setGame((c) => ({ ...c, expanded: !c.expanded }))
                  }
                  style={styles.expandButton}
                >
                  <Text style={styles.expandText}>
                    {game.expanded ? "Recolher −" : isChallenge ? "Ver instruções +" : "Faz render +"}
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
              ? isGroup ? "Deixa o papo acontecer." : isChallenge ? "Faz no teu ritmo. Pode pular quando quiser." : "Pensa no teu tempo."
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
                {game.index === deck.length - 1
                  ? "Encerrar lote ↗"
                  : "Próxima carta ↗"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => discardCard(true)}
              style={styles.skipButton}
            >
              <Text style={styles.mutedText}>← Pular essa</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B140F" },
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
