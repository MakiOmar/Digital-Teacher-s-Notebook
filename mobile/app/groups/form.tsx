import { useEffect, useState } from "react";
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
  PrimaryButton,
  Screen,
} from "@/src/components/ui";
import { TimeField } from "@/src/components/DateFields";
import { t } from "@/src/i18n/ar";
import {
  createGroup,
  getGroup,
  listPatterns,
  updateGroup,
} from "@/src/repositories";
import type { Weekday } from "@/src/db/types";
import { WEEKDAY_LABELS } from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { rtlChipRow, rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { generateSessionsForGroup } from "@/src/services/schedule";

const WEEKDAYS: Weekday[] = [6, 0, 1, 2, 3, 4, 5]; // Sat first for Arabic week

export default function GroupFormScreen() {
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
    if (!editId) return;
    void (async () => {
      const g = await getGroup(editId);
      if (!g) return;
      setName(g.name);
      setSubject(g.subject ?? "");
      setFee(String(g.default_monthly_fee));
      setClassesPerRound(String(g.classes_per_round ?? 4));
      const patterns = await listPatterns(editId);
      if (patterns.length) {
        setSelectedDays(patterns.map((p) => p.weekday as Weekday));
        setStartTime(patterns[0].start_time);
        setEndTime(patterns[0].end_time);
      }
    })();
  }, [editId]);

  function toggleDay(d: Weekday) {
    setSelectedDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  async function onSave() {
    if (!name.trim()) {
      await dialog.alert({ title: t("error"), message: t("required") });
      return;
    }
    if (!selectedDays.length) {
      await dialog.alert({ title: t("error"), message: t("scheduleDays") });
      return;
    }
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
          patterns,
        });
      } else {
        groupId = await createGroup({
          name: name.trim(),
          subject: subject.trim() || null,
          default_monthly_fee: feeNum,
          classes_per_round: roundNum,
          patterns,
        });
      }

      if (activeYear && groupId) {
        try {
          await generateSessionsForGroup(groupId);
        } catch {
          // year months may be empty
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
        message: e instanceof Error ? e.message : t("error"),
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

          <PrimaryButton
            label={saving ? t("loading") : t("save")}
            onPress={() => void onSave()}
            disabled={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
