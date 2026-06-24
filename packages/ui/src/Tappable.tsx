import { useRef } from "react";
import { Animated, Pressable } from "react-native";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** How small to shrink while held (default 0.95). */
  pressScale?: number;
};

/**
 * A Pressable that springs slightly smaller while held — the universal tap
 * feedback for every button in the app. Forwards all Pressable props; the
 * press-scale transform is composed onto the caller's style, so layout
 * (flex / size) is unchanged. Drop-in replacement for <Pressable>.
 */
export function Tappable({
  style,
  pressScale = 0.95,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) spring(pressScale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        spring(1);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
