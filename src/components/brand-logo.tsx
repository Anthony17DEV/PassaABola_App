import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

type Props = {
  size?: number;
  spinning?: boolean;
};

export default function BrandLogo({ size = 176, spinning = false }: Props) {
  const rotation = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      if (spinning) {
        rotation.value = 0;
        rotation.value = withRepeat(
          withTiming(360, {
            duration: 14000,
            easing: Easing.linear,
            reduceMotion: ReduceMotion.System,
          }),
          -1,
          false,
          undefined,
          ReduceMotion.System,
        );
      }

      return () => cancelAnimation(rotation);
    }, [spinning, rotation]),
  );

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View accessible={false} style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Path
            d="M 25 100 A 75 75 0 0 1 165 62"
            fill="none"
            stroke="#B7F34A"
            strokeWidth={19}
            strokeLinecap="round"
          />
          <Path
            d="M 144 61 L 174 73 L 176 40"
            fill="#B7F34A"
            stroke="#B7F34A"
            strokeWidth={10}
            strokeLinejoin="round"
          />

          <Path
            d="M 175 100 A 75 75 0 0 1 35 138"
            fill="none"
            stroke="#BCA5F5"
            strokeWidth={19}
            strokeLinecap="round"
          />
          <Path
            d="M 56 139 L 26 127 L 24 160"
            fill="#BCA5F5"
            stroke="#BCA5F5"
            strokeWidth={10}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Path
          d="
            M 100 125
            C 83 122 64 103 59 85
            C 55 70 78 82 91 103
            C 85 79 92 51 100 46
            C 108 51 115 79 109 103
            C 122 82 145 70 141 85
            C 136 103 117 122 100 125
            Z
          "
          fill="#B7F34A"
        />
        <Path
          d="
            M 100 123
            C 79 107 59 112 62 123
            C 66 136 86 138 97 128
            L 95 145
            Q 100 152 105 145
            L 103 128
            C 114 138 134 136 138 123
            C 141 112 121 107 100 123
            Z
          "
          fill="#B7F34A"
        />
      </Svg>
    </View>
  );
}
