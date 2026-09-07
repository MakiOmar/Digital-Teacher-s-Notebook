import { useCallback, useState, useMemo } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Muted, PrimaryButton, Screen, Title } from "@/src/components/ui";
import { useDialog } from "@/src/components/DialogProvider";
import {
  DEFAULT_CLASS_LEAD_MINUTES,
  DEFAULT_SOUND_REPEAT_INTERVAL,
  DEFAULT_SOUND_REPEAT_UNIT,
  loadReminderSettings,
  normalizeSoundRepeatInterval,
  openReminderSoundPicker,
  remindersAvailableInThisRuntime,
  saveReminderSettings,
  type ReminderSettings,
  type SoundRepeatUnit,
} from "@/src/reminders/reminders";
import { t } from "@/src/i18n/ar";
import { radii, spacing, type AppColors } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { rtlRow, rtlText } from "@/src/theme/rtl";
import { userFacingErrorMessage } from "@/src/utils/errors";

export default function RemindersScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dialog = useDialog();
  const schedulingOk = remindersAvailableInThisRuntime();
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>({
    classEnabled: true,
    unpaidEnabled: false,
    soundEnabled: true,
    soundRepeatMode: "once",
    soundRepeatInterval: DEFAULT_SOUND_REPEAT_INTERVAL,
    soundRepeatUnit: DEFAULT_SOUND_REPEAT_UNIT,
    classLeadMinutes: DEFAULT_CLASS_LEAD_MINUTES,
  });
  /** Draft text for interval so typing isn’t wiped by normalize-on-save. */
  const [intervalDraft, setIntervalDraft] = useState(
    String(DEFAULT_SOUND_REPEAT_INTERVAL)
  );

  useFocusEffect(
    useCallback(() => {
      void loadReminderSettings().then((next) => {
        setSettings(next);
        setIntervalDraft(String(next.soundRepeatInterval));
      });
    }, [])
  );

  async function persist(partial: Partial<ReminderSettings>) {
    setBusy(true);
    try {
      const next = await saveReminderSettings(partial);
      setSettings(next);
      setIntervalDraft(String(next.soundRepeatInterval));
      dialog.toast(t("remindersSaved"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onChangeSound() {
    setBusy(true);
    try {
      await openReminderSoundPicker();
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function commitInterval(
    raw: string,
    unit: SoundRepeatUnit = settings.soundRepeatUnit
  ) {
    const nextInterval = normalizeSoundRepeatInterval(raw, unit);
    if (
      nextInterval === settings.soundRepeatInterval &&
      unit === settings.soundRepeatUnit
    ) {
      setIntervalDraft(String(nextInterval));
      return;
    }
    await persist({ soundRepeatInterval: nextInterval, soundRepeatUnit: unit });
  }

  const showRepeatControls =
    settings.soundEnabled && settings.soundRepeatMode === "repeat";
  const unitLabel =
    settings.soundRepeatUnit === "seconds"
      ? t("reminderUnitSeconds")
      : t("reminderUnitMinutes");

  return (
    <Screen>
      {/* Page title */}
      <Title>{t("reminders")}</Title>
      <Muted style={{ marginBottom: spacing.lg }}>{t("remindersHint")}</Muted>
      {!schedulingOk ? (
        <Muted style={{ marginBottom: spacing.lg, color: colors.warning }}>
          {t("remindersExpoGoUnavailable")}
        </Muted>
      ) : null}

      {/* Class alerts: one local notification per upcoming session */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t("reminderTodayEnable")}</Text>
        <Switch
          value={settings.classEnabled}
          disabled={busy || !schedulingOk}
          onValueChange={(classEnabled) => void persist({ classEnabled })}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={
            settings.classEnabled ? colors.primary : colors.textMuted
          }
        />
      </View>

      {/* Weekly unpaid dues nudge */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t("reminderUnpaidEnable")}</Text>
        <Switch
          value={settings.unpaidEnabled}
          disabled={busy || !schedulingOk}
          onValueChange={(unpaidEnabled) => void persist({ unpaidEnabled })}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={
            settings.unpaidEnabled ? colors.primary : colors.textMuted
          }
        />
      </View>

      {/* Play notification sound when a reminder fires */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t("reminderSoundEnable")}</Text>
        <Switch
          value={settings.soundEnabled}
          disabled={busy || !schedulingOk}
          onValueChange={(soundEnabled) => void persist({ soundEnabled })}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={
            settings.soundEnabled ? colors.primary : colors.textMuted
          }
        />
      </View>

      {/* Repeat sound until the user taps or dismisses the notification */}
      {settings.soundEnabled ? (
        <View style={styles.switchRow}>
          <Text style={styles.label}>{t("reminderSoundRepeat")}</Text>
          <Switch
            value={settings.soundRepeatMode === "repeat"}
            disabled={busy || !schedulingOk}
            onValueChange={(repeat) =>
              void persist({ soundRepeatMode: repeat ? "repeat" : "once" })
            }
            trackColor={{ false: colors.border, true: colors.primarySoft }}
            thumbColor={
              settings.soundRepeatMode === "repeat"
                ? colors.primary
                : colors.textMuted
            }
          />
        </View>
      ) : null}
      {settings.soundEnabled ? (
        <Muted style={{ marginBottom: spacing.lg }}>
          {showRepeatControls
            ? t("reminderSoundRepeatHintDynamic", {
                interval: settings.soundRepeatInterval,
                unit: unitLabel,
              })
            : t("reminderSoundRepeatHint")}
        </Muted>
      ) : null}

      {/* Interval value + seconds/minutes unit */}
      {showRepeatControls ? (
        <View style={styles.intervalBlock}>
          <Text style={styles.label}>{t("reminderSoundRepeatInterval")}</Text>
          <View style={styles.intervalRow}>
            <TextInput
              value={intervalDraft}
              onChangeText={(text) =>
                setIntervalDraft(text.replace(/[^\d]/g, ""))
              }
              onEndEditing={() => void commitInterval(intervalDraft)}
              keyboardType="number-pad"
              editable={!busy && schedulingOk}
              style={styles.intervalInput}
              accessibilityLabel={t("reminderSoundRepeatInterval")}
            />
            <View style={styles.unitRow}>
              {(
                [
                  { id: "minutes" as const, label: t("reminderUnitMinutes") },
                  { id: "seconds" as const, label: t("reminderUnitSeconds") },
                ] as const
              ).map((opt) => {
                const on = settings.soundRepeatUnit === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    disabled={busy || !schedulingOk}
                    onPress={() => void commitInterval(intervalDraft, opt.id)}
                    style={[styles.unitChip, on && styles.unitChipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text
                      style={[styles.unitChipText, on && styles.unitChipTextOn]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      {/* Opens Android channel settings to pick any system ringtone */}
      <Muted style={{ marginBottom: spacing.sm }}>
        {Platform.OS === "android"
          ? t("reminderSoundPickerHint")
          : t("reminderSoundPickerHintIos")}
      </Muted>
      <PrimaryButton
        label={t("reminderSoundPicker")}
        onPress={() => void onChangeSound()}
        disabled={busy || !schedulingOk || !settings.soundEnabled}
        variant="ghost"
      />
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  switchRow: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  label: {
    ...rtlText,
    flex: 1,
    fontWeight: "700",
    color: colors.text,
  },
  intervalBlock: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  intervalRow: {
    ...rtlRow(),
    alignItems: "center",
    gap: spacing.sm,
  },
  intervalInput: {
    ...rtlText,
    width: 72,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontWeight: "700",
    fontSize: 16,
    color: colors.text,
  },
  unitRow: {
    ...rtlRow(),
    flex: 1,
    gap: 8,
  },
  unitChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unitChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  unitChipText: {
    ...rtlText,
    fontWeight: "700",
    fontSize: 13,
    color: colors.textMuted,
  },
  unitChipTextOn: {
    color: colors.primary,
  },
});
}
