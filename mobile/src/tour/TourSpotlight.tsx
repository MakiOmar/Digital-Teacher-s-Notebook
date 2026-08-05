import { useMemo } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "@/src/i18n/ar";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlText } from "@/src/theme/rtl";
import { getTourStep } from "./tourSteps";
import { useTour } from "./TourContext";

const PAD = 10;

/**
 * Dimmed overlay with a “hole” around the current TourAnchor and a tooltip card.
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
  const step = getTourStep(stepId);

  const { width: screenW, height: screenH } = Dimensions.get("window");

  const hole = useMemo(() => {
    if (!step?.targetId) return null;
    const r = targets[step.targetId];
    if (!r) return null;
    return {
      x: Math.max(0, r.x - PAD),
      y: Math.max(0, r.y - PAD),
      width: Math.min(screenW, r.width + PAD * 2),
      height: r.height + PAD * 2,
    };
  }, [step?.targetId, targets, screenW]);

  if (!active || !step) return null;

  const isDone = stepId === "done";
  const hasCreate = Boolean(step.createRoute);
  const canNext = Boolean(step.allowNext) || isDone;

  const cardTop = (() => {
    if (!hole) return Math.max(insets.top + 80, screenH * 0.28);
    const below = hole.y + hole.height + 16;
    const cardH = 220;
    if (below + cardH < screenH - insets.bottom - 24) return below;
    return Math.max(insets.top + 24, hole.y - cardH - 16);
  })();

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.root} pointerEvents="box-none">
        {/* Four-panel dim around the hole */}
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
          style={[
            styles.card,
            {
              top: cardTop,
              marginHorizontal: spacing.lg,
            },
          ]}
        >
          <Text style={styles.progress}>
            {t("tourProgress", {
              current: stepIndex + 1,
              total: stepCount,
            })}
          </Text>
          <Text style={styles.title}>{t(step.titleKey)}</Text>
          <Text style={styles.body}>{t(step.bodyKey)}</Text>

          <View style={styles.actions}>
            {!isDone ? (
              <Pressable onPress={() => void skip()} hitSlop={8}>
                <Text style={styles.skip}>{t("tourSkip")}</Text>
              </Pressable>
            ) : (
              <View />
            )}

            <View style={styles.primaryCol}>
              {hasCreate ? (
                <Pressable
                  style={styles.primaryBtn}
                  onPress={goCreate}
                >
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dim: {
    position: "absolute",
    backgroundColor: "rgba(15, 23, 42, 0.62)",
  },
  holeRing: {
    position: "absolute",
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: "transparent",
  },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    // Soft elevation
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  progress: {
    ...rtlText,
    width: "100%",
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  title: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 18,
    color: colors.text,
  },
  body: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: spacing.sm,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
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
