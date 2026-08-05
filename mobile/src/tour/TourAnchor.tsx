import { useEffect, useRef, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
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

  useEffect(() => {
    return () => unregisterTarget(id);
  }, [id, unregisterTarget]);

  function measure() {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      registerTarget(id, { x, y, width, height });
    });
  }

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(measure, 50);
    return () => clearTimeout(t);
  }, [active, stepId, id]);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={style}
      onLayout={() => {
        // Defer one frame so layout is settled
        requestAnimationFrame(measure);
      }}
    >
      {children}
    </View>
  );
}
