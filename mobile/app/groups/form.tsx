import { useEffect, useState, useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  FormField,
  Muted,
  Screen,
} from "@/src/components/ui";
import { useHeaderToolbar } from "@/src/components/useHeaderToolbar";
import { DateField, TimeField } from "@/src/components/DateFields";
import { t } from "@/src/i18n/ar";
import {
  createGroup,
  getGroup,
  listPatterns,
  updateGroup,
} from "@/src/repositories";
import type { Weekday } from "@/src/db/types";
import { WEEKDAY_LABELS, resolveGroupScheduleEnd, todayDateOnly } from "@/src/utils/date";
import { spacing, type AppColors } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { rtlChipRow, rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { generateSessionsForGroup } from "@/src/services/schedule";
import { userFacingErrorMessage } from "@/src/utils/errors";

const WEEKDAYS: Weekday[] = [6, 0, 1, 2, 3, 4, 5]; // Sat first for Arabic week

export default function GroupFormScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const router = useRouter();
  const navigation = useNavigation();
  const { bump, activeYear } = useAppData();
  const dialog = useDialog();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fee, setFee] = useState("");
  const [classesPerRound, setClassesPerRound] = useState("4");
  const [startDate, setStartDate] = useState(todayDateOnly());
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:00");
  const [selectedDays, setSelectedDays] = useState<Weekday[]>([6, 4]); // Sat + Thu
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: editId ? t("editGroup") : t("addGroup"),
    });
  }, [editId, navigation]);

  useEffect(() => {
    if (!editId) {
      // Any start date allowed — default to today, not year/semester start
      setStartDate(todayDateOnly());
      setEndDate("");
      return;
    }
    void (async () => {
      const g = await getGroup(editId);
      if (!g) return;
      setName(g.name);
      setSubject(g.subject ?? "");
      setFee(String(g.default_monthly_fee));
      setClassesPerRound(String(g.classes_per_round ?? 4));
      setStartDate(g.start_date || todayDateOnly());
      setEndDate(g.end_date || "");
      const patterns = await listPatterns(editId);
      if (patterns.length) {
        setSelectedDays(patterns.map((p) => p.weekday as Weekday));
        setStartTime(patterns[0].start_time);
        setEndTime(patterns[0].end_time);
      }
    })();
  }, [editId]);

  useHeaderToolbar({
    actions: [
      {
        key: "save",
        icon: "save",
        label: t("actionSave"),
        tone: "accent",
        disabled: saving,
        onPress: () => void onSave(),
      },
    ],
  });

  function toggleDay(d: Weekday) {
    setSelectedDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  async function onSave() {
    if (!name.trim()) {
      await dialog.alert({
        title: t("error"),
        message: t("fieldRequired", { field: t("groupName") }),
      });
      return;
    }
    if (!selectedDays.length) {
      await dialog.alert({
        title: t("error"),
        message: t("fieldSelectRequired", { field: t("scheduleDays") }),
      });
      return;
    }
    if (!startDate) {
      await dialog.alert({
        title: t("error"),
        message: t("fieldSelectRequired", { field: t("groupStartDate") }),
      });
      return;
    }
    if (endDate.trim() && endDate.trim() < startDate) {
      await dialog.alert({
        title: t("error"),
        message: t("groupDateOrder"),
      });
      return;
    }
    // End may be empty — schedule resolves to year end or start+12 months
    const resolvedEnd = resolveGroupScheduleEnd(
      startDate,
      endDate.trim() || null,
      activeYear?.end_date
    );
    const feeNum = Number(fee.replace(",", "."));
    if (Number.isNaN(feeNum) || feeNum < 0) {
      await dialog.alert({ title: t("error"), message: t("defaultFee") });
      return;
    }
    const roundNum = Math.floor(Number(classesPerRound.replace(",", ".")));
    if (!Number.isFinite(roundNum) || roundNum < 1) {
      await dialog.alert({ title: t("error"), message: t("classesPerRound") });
      return;
    }
    setSaving(true);
    try {
      const patterns = selectedDays.map((weekday) => ({
        weekday,
        start_time: startTime,
        end_time: endTime,
      }));
      let groupId = editId;
      if (editId) {
        await updateGroup(editId, {
          name: name.trim(),
          subject: subject.trim() || null,
          default_monthly_fee: feeNum,
          classes_per_round: roundNum,
          start_date: startDate,
          end_date: endDate.trim() || resolvedEnd,
          patterns,
        });
      } else {
        groupId = await createGroup({
          name: name.trim(),
          subject: subject.trim() || null,
          default_monthly_fee: feeNum,
          classes_per_round: roundNum,
          start_date: startDate,
          end_date: endDate.trim() || resolvedEnd,
          patterns,
        });
      }

      if (activeYear && groupId) {
        try {
          const generated = await generateSessionsForGroup(groupId);
          if (generated.skippedConflicts > 0) {
            await dialog.alert({
              title: t("scheduleConflictsSkippedTitle"),
              message: t("scheduleConflictsSkipped", {
                count: generated.skippedConflicts,
                groups: generated.conflictGroups.join("، "),
              }),
            });
          }
        } catch {
          // patterns/year may still be incomplete
        }
      }

      bump();
      if (!editId && groupId) {
        router.replace(`/groups/${groupId}`);
      } else {
        router.back();
      }
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <FormField label={t("groupName")} value={name} onChangeText={setName} />
          <FormField label={t("subject")} value={subject} onChangeText={setSubject} />
          <FormField
            label={t("defaultFee")}
            value={fee}
            onChangeText={setFee}
            keyboardType="numeric"
          />
          <FormField
            label={t("classesPerRound")}
            value={classesPerRound}
            onChangeText={setClassesPerRound}
            keyboardType="numeric"
            placeholder="4"
          />

          {/* Any calendar date — no semester / year min-max on the picker */}
          <DateField
            label={t("groupStartDate")}
            value={startDate}
            onChange={setStartDate}
          />
          <DateField
            label={t("groupEndDate")}
            value={
              endDate ||
              resolveGroupScheduleEnd(
                startDate,
                null,
                activeYear?.end_date
              )
            }
            onChange={setEndDate}
          />
          <Muted style={{ marginBottom: spacing.md }}>
            {t("groupDateHint")}
          </Muted>

          <TimeField
            label={t("startTime")}
            value={startTime}
            onChange={setStartTime}
          />
          <TimeField
            label={t("endTime")}
            value={endTime}
            onChange={setEndTime}
          />

          <Text style={styles.label}>{t("scheduleDays")}</Text>
          <View style={styles.days}>
            {WEEKDAYS.map((d) => {
              const selected = selectedDays.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => toggleDay(d)}
                  style={[styles.day, selected && styles.daySelected]}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                    {WEEKDAY_LABELS[d]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  label: {
    ...rtlText,
    width: "100%",
    fontWeight: "600",
    marginBottom: 8,
    color: colors.text,
  },
  days: {
    ...rtlChipRow(),
    gap: 8,
    marginBottom: spacing.lg,
    width: "100%",
  },
  day: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  daySelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: { color: colors.text, fontWeight: "600", ...rtlText },
  dayTextSelected: { color: "#fff" },
});
}
