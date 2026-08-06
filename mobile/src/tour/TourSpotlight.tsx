import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "@/src/i18n/ar";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlText } from "@/src/theme/rtl";
import { getTourStep, TOUR_STEPS } from "./tourSteps";
import { useTour } from "./TourContext";

const PAD_DEFAULT = 6;
/** Extra top pad for compact Add buttons — measure often sits under the icon top. */
const PAD_COMPACT_TOP = 12;
const PAD_COMPACT_BOTTOM = 6;
const PAD_COMPACT_H = 4;
/** Compact toolbar actions (إضافة). */
const COMPACT_MAX = 96;
const MAX_HOLE_H_RATIO = 0.38;
/** Lift payments summary spotlight so the ring clears the top card. */
const PAYMENTS_NUDGE_UP = 14;

/**
 * Place a rect using physical window coordinates.
 * Under I18nManager.forceRTL, Yoga can mirror `left` — translateX stays physical.
 */
function physicalRect(
  x: number,
  y: number,
  width: number,
  height: number
): ViewStyle {
  return {
    position: "absolute",
    top: y,
    left: 0,
    width,
    height,
    transform: [{ translateX: x }],
  };
}

/**
 * Spotlight overlay in the same window as the app (not a Modal).
 * Root uses LTR so dim edges + hole match measureInWindow (physical coords).
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
    if (!r || r.width < 8 || r.height < 8) return null;

    const sheetReserve = Math.max(sheetH, 180) + 8;
    const usableTop = insets.top + 4;
    const usableBottom = screenH - sheetReserve;

    // Target still off-screen (scroll settling) — hide hole rather than invent a fake one
    if (r.y + r.height < usableTop + 12 || r.y > usableBottom - 12) {
      return null;
    }

    const compact = r.width <= COMPACT_MAX && r.height <= COMPACT_MAX;
    const padTop = compact
      ? PAD_COMPACT_TOP
      : step.targetId === "paymentsHeader"
        ? PAD_DEFAULT + PAYMENTS_NUDGE_UP
        : PAD_DEFAULT;
    const padBottom = compact ? PAD_COMPACT_BOTTOM : PAD_DEFAULT;
    const padH = compact ? PAD_COMPACT_H : PAD_DEFAULT;

    // Compact Add sits near the status bar — allow hole into the inset, don't clip the icon
    const minY = compact
      ? Math.max(0, insets.top - 10)
      : insets.top + 4;

    const maxH = Math.max(
      64,
      screenH * (compact ? 0.28 : r.height > 200 ? 0.48 : MAX_HOLE_H_RATIO)
    );

    // Grow from the measured rect; only trim overflow edges (don't shift the center)
    let x = r.x - padH;
    let y = r.y - padTop;
    let width = r.width + padH * 2;
    let height = Math.min(r.height + padTop + padBottom, maxH);

    if (x < 4) {
      width -= 4 - x;
      x = 4;
    }
    if (x + width > screenW - 4) {
      width = Math.max(32, screenW - 4 - x);
    }
    if (y < minY) {
      // Keep full height covering the target: prefer overlapping status chrome
      // over clipping the top of Add icons
      y = minY;
    }
    if (y + height > usableBottom) {
      height = Math.max(32, usableBottom - y);
    }

    return { x, y, width, height };
  }, [
    step?.targetId,
    targets,
    screenW,
    screenH,
    sheetH,
    insets.top,
  ]);

  if (!active || !step) return null;

  const isDone = stepId === "done";
  const hasCreate = Boolean(step.createRoute);
  const canNext = Boolean(step.allowNext) || isDone;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { direction: "ltr" }]}
    >
      {hole ? (
        <>
          <View
            pointerEvents="none"
            style={[styles.dim, physicalRect(0, 0, screenW, hole.y)]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.dim,
              physicalRect(
                0,
                hole.y + hole.height,
                screenW,
                Math.max(0, screenH - hole.y - hole.height)
              ),
            ]}
          />
          <View
            pointerEvents="none"
            style={[styles.dim, physicalRect(0, hole.y, hole.x, hole.height)]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.dim,
              physicalRect(
                hole.x + hole.width,
                hole.y,
                Math.max(0, screenW - hole.x - hole.width),
                hole.height
              ),
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.holeRing,
              physicalRect(hole.x, hole.y, hole.width, hole.height),
            ]}
          />
        </>
      ) : (
        <View pointerEvents="none" style={[styles.dim, StyleSheet.absoluteFill]} />
      )}

      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setSheetH((prev) => (Math.abs(prev - h) > 2 ? h : prev));
        }}
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
            direction: "rtl",
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
                  style={[styles.primaryBtn, hasCreate && styles.secondaryBtn]}
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
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    elevation: 10000,
    justifyContent: "flex-end",
  },
  dim: {
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  holeRing: {
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
    width: "100%",
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
