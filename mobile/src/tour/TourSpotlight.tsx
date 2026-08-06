import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "@/src/i18n/ar";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlText } from "@/src/theme/rtl";
import { getTourStep, TOUR_STEPS } from "./tourSteps";
import { useTour } from "./TourContext";

const PAD = 10;
/** Cap spotlight hole so a tall list/menu does not swallow the screen. */
const MAX_HOLE_H_RATIO = 0.28;

/**
 * Dimmed overlay with a spotlight hole + fixed bottom action sheet
 * (always on-screen — never positions the CTAs under the fold).
 */
export function TourSpotlight() {
  const {
    active,
    stepId,
    stepIndex,
    stepCount,
    targets,
    skip,
    next,
    goCreate,
    finish,
  } = useTour();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const step = getTourStep(stepId);
  const [sheetH, setSheetH] = useState(0);

  const hole = useMemo(() => {
    if (!step?.targetId) return null;
    const r = targets[step.targetId];
    if (!r || r.width <= 0 || r.height <= 0) return null;

    const maxH = Math.max(72, screenH * MAX_HOLE_H_RATIO);
    let height = Math.min(r.height + PAD * 2, maxH);
    let y = Math.max(0, r.y - PAD);
    // Keep hole above the bottom sheet
    const sheetReserve = Math.max(sheetH, 200) + insets.bottom + 12;
    const maxBottom = screenH - sheetReserve;
    if (y + height > maxBottom) {
      y = Math.max(insets.top + 8, maxBottom - height);
    }

    return {
      x: Math.max(0, r.x - PAD),
      y,
      width: Math.min(screenW - 8, r.width + PAD * 2),
      height,
    };
  }, [step?.targetId, targets, screenW, screenH, sheetH, insets.bottom, insets.top]);

  if (!active || !step) return null;

  const isDone = stepId === "done";
  const hasCreate = Boolean(step.createRoute);
  const canNext = Boolean(step.allowNext) || isDone;
  const isLandscape = screenW > screenH;
  const sheetMaxW = Math.min(480, screenW);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.root} pointerEvents="box-none">
        {hole ? (
          <>
            <View
              style={[
                styles.dim,
                { left: 0, top: 0, right: 0, height: hole.y },
              ]}
            />
            <View
              style={[
                styles.dim,
                {
                  left: 0,
                  top: hole.y + hole.height,
                  right: 0,
                  bottom: 0,
                },
              ]}
            />
            <View
              style={[
                styles.dim,
                {
                  left: 0,
                  top: hole.y,
                  width: hole.x,
                  height: hole.height,
                },
              ]}
            />
            <View
              style={[
                styles.dim,
                {
                  left: hole.x + hole.width,
                  top: hole.y,
                  right: 0,
                  height: hole.height,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.holeRing,
                {
                  left: hole.x,
                  top: hole.y,
                  width: hole.width,
                  height: hole.height,
                },
              ]}
            />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        {/* Fixed bottom sheet — always within safe area / reachable */}
        <View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setSheetH((prev) => (Math.abs(prev - h) > 2 ? h : prev));
          }}
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxWidth: sheetMaxW,
              alignSelf: "center",
              width: isLandscape ? sheetMaxW : "100%",
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.cardInner}>
            <Text style={styles.progress}>
              {t("tourProgress", {
                current: stepIndex + 1,
                total: stepCount,
              })}
            </Text>
            <View style={styles.dots}>
              {TOUR_STEPS.map((s, i) => (
                <View
                  key={s.id}
                  style={[
                    styles.dot,
                    i === stepIndex && styles.dotActive,
                    i < stepIndex && styles.dotDone,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.title}>{t(step.titleKey)}</Text>
            <Text style={styles.body}>{t(step.bodyKey)}</Text>

            <View style={styles.actions}>
              {!isDone ? (
                <Pressable onPress={() => void skip()} hitSlop={12}>
                  <Text style={styles.skip}>{t("tourSkip")}</Text>
                </Pressable>
              ) : (
                <View />
              )}

              <View style={styles.primaryCol}>
                {hasCreate ? (
                  <Pressable style={styles.primaryBtn} onPress={goCreate}>
                    <Text style={styles.primaryText}>{t("tourCreateNow")}</Text>
                  </Pressable>
                ) : null}
                {canNext ? (
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      hasCreate && styles.secondaryBtn,
                    ]}
                    onPress={() => void (isDone ? finish() : next())}
                  >
                    <Text
                      style={[
                        styles.primaryText,
                        hasCreate && styles.secondaryText,
                      ]}
                    >
                      {isDone ? t("tourFinish") : t("tourNext")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  dim: {
    position: "absolute",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  holeRing: {
    position: "absolute",
    borderRadius: radii.lg,
    borderWidth: 2.5,
    borderColor: colors.primary,
    backgroundColor: "transparent",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 4,
  },
  cardInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  progress: {
    ...rtlText,
    width: "100%",
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  dots: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.primary,
  },
  dotDone: {
    backgroundColor: colors.accent,
  },
  title: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 18,
    color: colors.text,
  },
  body: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 23,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  skip: {
    ...rtlText,
    fontFamily: fonts.bold,
    fontWeight: "700",
    color: colors.textMuted,
    paddingVertical: 8,
  },
  primaryCol: {
    flexDirection: "row-reverse",
    gap: 8,
    flexShrink: 1,
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
  },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  primaryText: {
    ...rtlText,
    fontFamily: fonts.bold,
    fontWeight: "700",
    color: "#fff",
  },
  secondaryText: {
    color: colors.primary,
  },
});
