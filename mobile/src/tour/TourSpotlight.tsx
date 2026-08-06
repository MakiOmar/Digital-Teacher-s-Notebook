import { useEffect, useMemo, useState } from "react";
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

const PAD = 12;

/**
 * Dimmed overlay with a spotlight hole around the current TourAnchor
 * and a guided tooltip card (rotation-aware).
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
  const [cardH, setCardH] = useState(200);

  const hole = useMemo(() => {
    if (!step?.targetId) return null;
    const r = targets[step.targetId];
    if (!r) return null;
    return {
      x: Math.max(0, r.x - PAD),
      y: Math.max(0, r.y - PAD),
      width: Math.min(screenW - 8, r.width + PAD * 2),
      height: Math.min(screenH - 8, r.height + PAD * 2),
    };
  }, [step?.targetId, targets, screenW, screenH]);

  // Recompute card placement when window size changes (rotation)
  useEffect(() => {
    setCardH((h) => h);
  }, [screenW, screenH]);

  if (!active || !step) return null;

  const isDone = stepId === "done";
  const hasCreate = Boolean(step.createRoute);
  const canNext = Boolean(step.allowNext) || isDone;
  const isLandscape = screenW > screenH;
  const cardMaxW = Math.min(420, screenW - spacing.lg * 2);

  const cardTop = (() => {
    if (!hole) return Math.max(insets.top + 72, screenH * 0.26);
    const below = hole.y + hole.height + 14;
    if (below + cardH < screenH - insets.bottom - 20) return below;
    return Math.max(insets.top + 16, hole.y - cardH - 14);
  })();

  const cardLeft = isLandscape
    ? Math.max(spacing.md, (screenW - cardMaxW) / 2)
    : spacing.lg;

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

        <View
          onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
          style={[
            styles.card,
            {
              top: cardTop,
              left: cardLeft,
              width: cardMaxW,
              maxWidth: cardMaxW,
            },
          ]}
        >
          <View style={styles.accentBar} />
          <View style={styles.cardInner}>
            <View style={styles.metaRow}>
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
            </View>
            <Text style={styles.title}>{t(step.titleKey)}</Text>
            <Text style={styles.body}>{t(step.bodyKey)}</Text>

            <View style={styles.actions}>
              {!isDone ? (
                <Pressable onPress={() => void skip()} hitSlop={10}>
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
  card: {
    position: "absolute",
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  accentBar: {
    height: 4,
    backgroundColor: colors.primary,
    width: "100%",
  },
  cardInner: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  metaRow: {
    gap: 8,
    marginBottom: 2,
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
