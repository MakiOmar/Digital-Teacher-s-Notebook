import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LanguageSwitcher } from "@/src/components/LanguageSwitcher";
import { FormField, Muted, Screen, Title } from "@/src/components/ui";
import { useDialog } from "@/src/components/DialogProvider";
import {
  PAGE_SIZE_OPTIONS,
  type PageSizeOption,
} from "@/src/settings/generalSettings";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import { useCurrency } from "@/src/settings/CurrencyContext";
import {
  CURRENCY_PRESETS,
  type CurrencyId,
} from "@/src/settings/currency";
import { t } from "@/src/i18n/ar";
import { useLanguage } from "@/src/i18n/LanguageContext";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlChipRow, rtlText } from "@/src/theme/rtl";
import { userFacingErrorMessage } from "@/src/utils/errors";
import { formatInteger } from "@/src/utils/numbers";

/** General app settings — language, currency, and page size. */
export default function GeneralSettingsScreen() {
  const { pageSize, setPageSize } = useGeneralSettings();
  const { currencyId, customSymbol, setCurrency } = useCurrency();
  const { language } = useLanguage();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  // Local draft for custom symbol so typing does not save on every keystroke.
  const [customDraft, setCustomDraft] = useState(customSymbol);

  useEffect(() => {
    setCustomDraft(customSymbol);
  }, [customSymbol]);

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

  async function onSelectCurrency(id: CurrencyId) {
    if (id === currencyId && id !== "custom") return;
    setBusy(true);
    try {
      await setCurrency(id, id === "custom" ? customDraft : customSymbol);
      dialog.toast(t("currencySaved"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveCustomSymbol() {
    setBusy(true);
    try {
      await setCurrency("custom", customDraft);
      dialog.toast(t("currencySaved"), "success");
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
    <Screen style={{ flex: 1, paddingHorizontal: 0 }}>
      {/* Scroll so currency custom field + page size stay reachable on small phones */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl * 2,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section: preferred UI language */}
        <Title>{t("generalSettings")}</Title>
        <Muted style={{ marginBottom: spacing.lg }}>
          {t("generalSettingsHint")}
        </Muted>

        <Text style={styles.label}>{t("preferredLanguage")}</Text>
        <Muted style={{ marginBottom: spacing.md }}>
          {t("preferredLanguageHint")}
        </Muted>
        {/* Flagged cards — same control as setup wizard */}
        <LanguageSwitcher variant="cards" disabled={busy} />

        {/* Section: app currency presets + optional custom symbol */}
        <Text style={[styles.label, { marginTop: spacing.xl }]}>
          {t("appCurrency")}
        </Text>
        <Muted style={{ marginBottom: spacing.md }}>{t("appCurrencyHint")}</Muted>

        <View style={styles.row}>
          {CURRENCY_PRESETS.map((preset) => {
            const selected = currencyId === preset.id;
            const label = language === "en" ? preset.en : preset.ar;
            return (
              <Pressable
                key={preset.id}
                disabled={busy}
                onPress={() => void onSelectCurrency(preset.id)}
                style={[styles.chip, selected && styles.chipOn]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
          {/* Plus chip opens the custom currency path */}
          <Pressable
            disabled={busy}
            onPress={() => void onSelectCurrency("custom")}
            style={[styles.chip, currencyId === "custom" && styles.chipOn]}
            accessibilityLabel={t("currencyCustom")}
          >
            <Text
              style={[
                styles.chipText,
                currencyId === "custom" && styles.chipTextOn,
              ]}
            >
              +
            </Text>
          </Pressable>
        </View>

        {currencyId === "custom" ? (
          <View style={{ marginTop: spacing.md, width: "100%" }}>
            <FormField
              label={t("currencyCustomSymbol")}
              value={customDraft}
              onChangeText={setCustomDraft}
              placeholder={t("currencyCustomPlaceholder")}
            />
            <Pressable
              disabled={busy || !customDraft.trim()}
              onPress={() => void onSaveCustomSymbol()}
              style={[
                styles.saveBtn,
                (!customDraft.trim() || busy) && styles.saveBtnDisabled,
              ]}
            >
              <Text style={styles.saveBtnText}>{t("save")}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Section: list page size */}
        <Text style={[styles.label, { marginTop: spacing.xl }]}>
          {t("pageSize")}
        </Text>
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
                {/* Page size chips use localized digits for Arabic UI */}
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {formatInteger(n)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
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
    flexWrap: "wrap",
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
  saveBtn: {
    marginTop: spacing.sm,
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    color: "#fff",
  },
});
