import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SessionScreen() {
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
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

        <Text style={styles.eyebrow}>BORA COMEÇAR</Text>

        <Text accessibilityRole="header" style={styles.title}>
          Como vai ser{"\n"}a sessão?
        </Text>

        <Text style={styles.description}>
          Um tempo contigo ou uma resenha com a galera?
        </Text>

        <View style={styles.cards}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sessão solo"
            onPress={() =>
              router.push({
                pathname: "/modos",
                params: { sessao: "solo" },
              })
            }
            style={({ pressed }) => [
              styles.card,
              styles.soloCard,
              pressed && styles.pressed,
            ]}
          >
            <Text accessible={false} style={styles.emoji}>
              🪐
            </Text>

            <Text style={styles.cardTag}>NO TEU RITMO</Text>
            <Text style={styles.cardTitle}>Sessão solo</Text>

            <Text style={styles.cardDescription}>
              Viaja nas ideias, encara uns desafios ou descobre algo pra
              assistir e ouvir.
            </Text>

            <Text style={styles.soloAction}>Essa é minha vibe ↗</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sessão com amigos"
            onPress={() =>
              router.push({
                pathname: "/modos",
                params: { sessao: "amigos" },
              })
            }
            style={({ pressed }) => [
              styles.card,
              styles.friendsCard,
              pressed && styles.pressed,
            ]}
          >
            <Text accessible={false} style={styles.emoji}>
              ✌️
            </Text>

            <Text style={styles.cardTag}>JUNTA A GALERA</Text>
            <Text style={styles.cardTitle}>Sessão com amigos</Text>

            <Text style={styles.cardDescription}>
              Perguntas, desafios e assuntos pra ninguém ficar sem ter o que
              falar.
            </Text>

            <Text style={styles.friendsAction}>Bora de resenha ↗</Text>
          </Pressable>
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
    marginTop: 14,
  },
  cards: {
    gap: 18,
    marginTop: 30,
  },
  card: {
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
  },
  soloCard: {
    backgroundColor: "#18271A",
    borderColor: "#38532C",
  },
  friendsCard: {
    backgroundColor: "#211E30",
    borderColor: "#493D62",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  emoji: {
    fontSize: 36,
    marginBottom: 20,
  },
  cardTag: {
    color: "#B4C0B8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
  },
  cardTitle: {
    color: "#F6F7EF",
    fontSize: 26,
    fontWeight: "800",
  },
  cardDescription: {
    color: "#C1CBC4",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
  },
  soloAction: {
    color: "#B7F34A",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 22,
  },
  friendsAction: {
    color: "#BCA5F5",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 22,
  },
});
