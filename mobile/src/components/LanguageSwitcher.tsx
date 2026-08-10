import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useDialog } from "@/src/components/DialogProvider";
import { t } from "@/src/i18n/ar";
import { useLanguage } from "@/src/i18n/LanguageContext";
import type { AppLanguage } from "@/src/i18n/language";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlChipRow, rtlText } from "@/src/theme/rtl";
import { userFacingErrorMessage } from "@/src/utils/errors";

export const LANGUAGE_OPTIONS: {
  id: AppLanguage;
  flag: string;
  labelKey: "languageArabic" | "languageEnglish";
}[] = [
  { id: "ar", flag: "🇪🇬", labelKey: "languageArabic" },
  { id: "en", flag: "🇬🇧", labelKey: "languageEnglish" },
];

const PILL_SLOT = 34;
const PILL_GAP = 2;
const PILL_PAD = 3;

type ControlledProps = {
  /** Controlled value (wizard). When set, parent handles persistence. */
  value: AppLanguage;
  onChange: (lang: AppLanguage) => void;
};

type UncontrolledProps = {
  value?: undefined;
  onChange?: undefined;
};

type CommonProps = {
  /** Compact home pill vs larger labeled cards. */
  variant?: "pill" | "cards";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  showToast?: boolean;
};

type Props = CommonProps & (ControlledProps | UncontrolledProps);

/** Flagged Arabic / English language switcher. */
export function LanguageSwitcher(props: Props) {
  const { variant = "pill", disabled, style, showToast = true } = props;
  const dialog = useDialog();
  const { language, setLanguage } = useLanguage();
  const [busy, setBusy] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const selected =
    props.value !== undefined ? props.value : language;

  const thumbX = useRef(
    new Animated.Value(selected === "en" ? PILL_SLOT + PILL_GAP : 0)
  ).current;

  useEffect(() => {
    Animated.spring(thumbX, {
      toValue: selected === "en" ? PILL_SLOT + PILL_GAP : 0,
      friction: 7,
      tension: 140,
      useNativeDriver: false,
    }).start();
  }, [selected, thumbX]);

  function bump() {
    scale.setValue(0.94);
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }

  async function select(next: AppLanguage) {
    if (disabled || busy || next === selected) return;
    bump();

    if (props.value !== undefined) {
      props.onChange(next);
      return;
    }

    setBusy(true);
    try {
      await setLanguage(next);
      if (showToast) dialog.toast(t("languageSaved"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  if (variant === "cards") {
    return (
      <View style={[styles.cardsRow, style]}>
        {LANGUAGE_OPTIONS.map((opt) => {
          const on = selected === opt.id;
          return (
            <Pressable
              key={opt.id}
              disabled={disabled || busy}
              onPress={() => void select(opt.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(opt.labelKey)}
              style={[styles.card, on && styles.cardOn]}
            >
              <Text style={styles.cardFlag}>{opt.flag}</Text>
              <Text style={[styles.cardLabel, on && styles.cardLabelOn]}>
                {t(opt.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // Compact segmented pill — home header & tight spaces
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <View style={styles.pill}>
        {/* Soft sliding highlight behind the active flag */}
        <Animated.View
          style={[
            styles.pillThumb,
            { transform: [{ translateX: thumbX }] },
          ]}
        />
        {LANGUAGE_OPTIONS.map((opt) => {
          const on = selected === opt.id;
          return (
            <Pressable
              key={opt.id}
              disabled={disabled || busy}
              onPress={() => void select(opt.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(opt.labelKey)}
              style={styles.pillHit}
            >
              <Text style={[styles.pillFlag, on && styles.pillFlagOn]}>
                {opt.flag}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: PILL_PAD,
    gap: PILL_GAP,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  pillThumb: {
    position: "absolute",
    top: PILL_PAD,
    bottom: PILL_PAD,
    left: PILL_PAD,
    width: PILL_SLOT,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pillHit: {
    width: PILL_SLOT,
    height: PILL_SLOT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  pillFlag: {
    fontSize: 18,
    opacity: 0.55,
  },
  pillFlagOn: {
    opacity: 1,
  },
  cardsRow: {
    ...rtlChipRow(),
    gap: spacing.sm,
  },
  card: {
    minWidth: 120,
    flexGrow: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  cardFlag: {
    fontSize: 28,
  },
  cardLabel: {
    ...rtlText,
    fontFamily: fonts.bold,
    fontWeight: "700",
    color: colors.text,
    fontSize: 14,
  },
  cardLabelOn: {
    color: colors.primaryDark,
  },
});
