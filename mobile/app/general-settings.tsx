import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LanguageSwitcher } from "@/src/components/LanguageSwitcher";
import { Muted, Screen, Title } from "@/src/components/ui";
import { useDialog } from "@/src/components/DialogProvider";
import {
  PAGE_SIZE_OPTIONS,
  type PageSizeOption,
} from "@/src/settings/generalSettings";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import { t } from "@/src/i18n/ar";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlChipRow, rtlText } from "@/src/theme/rtl";
import { userFacingErrorMessage } from "@/src/utils/errors";

/** General app settings — page size and preferred language. */
export default function GeneralSettingsScreen() {
  const { pageSize, setPageSize } = useGeneralSettings();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);

  async function onSelectPageSize(next: PageSizeOption) {
    if (next === pageSize) return;
    setBusy(true);
    try {
      await setPageSize(next);
      dialog.toast(t("generalSettingsSaved"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t("generalSettings")}</Title>
      <Muted style={{ marginBottom: spacing.lg }}>{t("generalSettingsHint")}</Muted>

      <Text style={styles.label}>{t("preferredLanguage")}</Text>
      <Muted style={{ marginBottom: spacing.md }}>{t("preferredLanguageHint")}</Muted>
      {/* Flagged cards — same control as setup wizard */}
      <LanguageSwitcher variant="cards" disabled={busy} />

      <Text style={[styles.label, { marginTop: spacing.xl }]}>{t("pageSize")}</Text>
      <Muted style={{ marginBottom: spacing.md }}>{t("pageSizeHint")}</Muted>

      <View style={styles.row}>
        {PAGE_SIZE_OPTIONS.map((n) => {
          const selected = pageSize === n;
          return (
            <Pressable
              key={n}
              disabled={busy}
              onPress={() => void onSelectPageSize(n)}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.bold,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: {
    ...rtlChipRow(),
    gap: 8,
  },
  chip: {
    minWidth: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...rtlText,
    fontFamily: fonts.bold,
    fontWeight: "700",
    color: colors.text,
  },
  chipTextOn: { color: "#fff" },
});
