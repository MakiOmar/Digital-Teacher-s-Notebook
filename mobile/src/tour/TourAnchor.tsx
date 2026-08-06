import { useEffect, useRef, type ReactNode } from "react";
import {
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTour } from "./TourContext";
import type { TourTargetId } from "./tourSteps";

type Props = {
  id: TourTargetId;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Registers its window rect so the spotlight can cut a hole around it. */
export function TourAnchor({ id, children, style }: Props) {
  const { registerTarget, unregisterTarget, active, activeTargetId } =
    useTour();
  const ref = useRef<View>(null);
  const { width, height } = useWindowDimensions();
  const isCurrent = active && activeTargetId === id;

  useEffect(() => {
    return () => unregisterTarget(id);
  }, [id, unregisterTarget]);

  function measure() {
    if (!isCurrent) return;
    ref.current?.measureInWindow((x, y, w, h) => {
      if (w <= 0 || h <= 0) return;
      registerTarget(id, { x, y, width: w, height: h });
    });
  }

  useEffect(() => {
    if (!isCurrent) return;
    const t = setTimeout(measure, 80);
    return () => clearTimeout(t);
  }, [isCurrent, id, width, height]);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={style}
      onLayout={() => {
        if (!isCurrent) return;
        requestAnimationFrame(measure);
      }}
    >
      {children}
    </View>
  );
}
