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
  const { registerTarget, unregisterTarget, stepId, active } = useTour();
  const ref = useRef<View>(null);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    return () => unregisterTarget(id);
  }, [id, unregisterTarget]);

  function measure() {
    ref.current?.measureInWindow((x, y, w, h) => {
      if (w <= 0 || h <= 0) return;
      registerTarget(id, { x, y, width: w, height: h });
    });
  }

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
  }, [active, stepId, id, width, height]);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={style}
      onLayout={() => {
        requestAnimationFrame(measure);
      }}
    >
      {children}
    </View>
  );
}
