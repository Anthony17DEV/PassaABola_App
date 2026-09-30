import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import BrandLogo from "../components/brand-logo";

const MINI_LOGOS = [
  { x: 0.03, y: 0.04, size: 72, angle: 15, duration: 32000 },
  { x: 0.52, y: 0.02, size: 48, angle: 85, duration: 42000 },
  { x: 0.83, y: 0.15, size: 82, angle: 130, duration: 37000 },
  { x: 0.25, y: 0.23, size: 44, angle: 40, duration: 46000 },
  { x: 0.02, y: 0.39, size: 92, angle: 210, duration: 40000 },
  { x: 0.79, y: 0.43, size: 58, angle: 65, duration: 34000 },
  { x: 0.12, y: 0.63, size: 52, angle: 160, duration: 43000 },
  { x: 0.67, y: 0.7, size: 90, angle: 25, duration: 48000 },
  { x: 0.02, y: 0.88, size: 76, angle: 110, duration: 36000 },
  { x: 0.43, y: 0.91, size: 46, angle: 250, duration: 41000 },
];

type FloatingLogoProps = (typeof MINI_LOGOS)[number] & {
  reverse: boolean;
};

function FloatingLogo({
  x,
  y,
  size,
  angle,
  duration,
  reverse,
}: FloatingLogoProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const maxX = Math.max(0, width - size);
  const maxY = Math.max(0, height - size);

  const positionX = useSharedValue(Math.max(0, Math.min(maxX, width * x)));
  const positionY = useSharedValue(Math.max(0, Math.min(maxY, height * y)));

  const speed = 22 + (48000 - duration) / 1000;

  const velocityX = useSharedValue(reverse ? -speed : speed);
  const velocityY = useSharedValue((reverse ? 1 : -1) * speed * 0.75);

  const frame = useFrameCallback((info) => {
    "worklet";

    const seconds = Math.min(info.timeSincePreviousFrame ?? 0, 40) / 1000;

    let nextX = positionX.value + velocityX.value * seconds;
    let nextY = positionY.value + velocityY.value * seconds;

    if (nextX <= 0) {
      nextX = 0;
      velocityX.value = Math.abs(velocityX.value);
    } else if (nextX >= maxX) {
      nextX = maxX;
      velocityX.value = -Math.abs(velocityX.value);
    }

    if (nextY <= 0) {
      nextY = 0;
      velocityY.value = Math.abs(velocityY.value);
    } else if (nextY >= maxY) {
      nextY = maxY;
      velocityY.value = -Math.abs(velocityY.value);
    }

    positionX.value = nextX;
    positionY.value = nextY;
  }, false);

  useFocusEffect(
    useCallback(() => {
      frame.setActive(!reduceMotion);

      return () => {
        frame.setActive(false);
      };
    }, [frame, reduceMotion]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: positionX.value },
      { translateY: positionY.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.miniLogo,
        {
          width: size,
          height: size,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          transform: [{ rotate: `${angle}deg` }],
        }}
      >
        <BrandLogo size={size} />
      </View>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  return (
    <View style={styles.screen}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.background}
      >
        {MINI_LOGOS.map((item, index) => (
          <FloatingLogo key={index} {...item} reverse={index % 2 === 0} />
        ))}
      </View>

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.brand}>
            <BrandLogo size={176} spinning />

            <Text
              accessibilityRole="header"
              accessibilityLabel="Passa a Bola"
              style={styles.title}
            >
              PASSA{"\n"}
              <Text style={styles.titleAccent}>A BOLA</Text>
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Iniciar"
            accessibilityHint="Abre a escolha da sua sessão"
            onPress={() => router.push("/sessao")}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>Iniciar</Text>

            <Text accessible={false} style={styles.buttonArrow}>
              ↗
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B140F",
  },

  background: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },

  miniLogo: {
    position: "absolute",
    left: 0,
    top: 0,
    opacity: 0.1,
  },

  safeArea: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 56,
  },

  brand: {
    alignItems: "center",
    gap: 28,
  },

  title: {
    color: "#F6F7EF",
    fontSize: 52,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -2,
    lineHeight: 56,
  },

  titleAccent: {
    color: "#B7F34A",
  },

  button: {
    width: "100%",
    maxWidth: 320,
    minHeight: 62,
    paddingHorizontal: 26,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: "#B7F34A",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  buttonText: {
    color: "#102019",
    fontSize: 20,
    fontWeight: "800",
  },

  buttonArrow: {
    color: "#102019",
    fontSize: 26,
    fontWeight: "700",
  },
});
