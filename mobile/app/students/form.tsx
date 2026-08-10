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
  Screen,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { DateField } from "@/src/components/DateFields";
import { t } from "@/src/i18n/ar";
import {
  createStudent,
  getActiveEnrollment,
  getStudent,
  listGroups,
  updateStudent,
} from "@/src/repositories";
import type { StudyGroup } from "@/src/db/types";
import { todayDateOnly } from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { rtlChipRow, rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { userFacingErrorMessage } from "@/src/utils/errors";

export default function StudentFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const router = useRouter();
  const navigation = useNavigation();
  const { bump } = useAppData();
  const dialog = useDialog();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");
  const [customFee, setCustomFee] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [startDate, setStartDate] = useState(todayDateOnly());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: editId ? t("editStudent") : t("addStudent"),
    });
  }, [editId, navigation]);

  useEffect(() => {
    void (async () => {
      const g = await listGroups();
      setGroups(g);
      if (!editId && g[0]) setGroupId(g[0].id);
      if (!editId) return;
      const s = await getStudent(editId);
      if (!s) return;
      setName(s.name);
      setPhone(s.guardian_phone ?? "");
      setNotes(s.notes ?? "");
      setStatus(s.status);
      const en = await getActiveEnrollment(editId);
      if (en) {
        setGroupId(en.group_id);
        setCustomFee(
          en.custom_monthly_fee != null ? String(en.custom_monthly_fee) : ""
        );
        if (en.start_date) setStartDate(en.start_date);
      }
    })();
  }, [editId]);

  async function onSave() {
    if (!name.trim() || !groupId) {
      await dialog.alert({ title: t("error"), message: t("required") });
      return;
    }
    const feeVal =
      customFee.trim() === "" ? null : Number(customFee.replace(",", "."));
    if (feeVal != null && Number.isNaN(feeVal)) {
      await dialog.alert({ title: t("error"), message: t("customFee") });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateStudent(editId, {
          name: name.trim(),
          guardian_phone: phone.trim() || null,
          notes: notes.trim() || null,
          status,
          group_id: groupId,
          custom_monthly_fee: feeVal,
        });
      } else {
        await createStudent({
          name: name.trim(),
          guardian_phone: phone.trim() || null,
          notes: notes.trim() || null,
          status,
          group_id: groupId,
          custom_monthly_fee: feeVal,
          start_date: startDate,
        });
      }
      bump();
      router.back();
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
          <IconActionBar
            actions={[
              {
                key: "save",
                icon: "save",
                label: t("actionSave"),
                tone: "accent",
                disabled: saving,
                onPress: () => void onSave(),
              },
            ]}
          />
          <FormField label={t("studentName")} value={name} onChangeText={setName} />
          <FormField
            label={t("guardianPhone")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <FormField
            label={t("notes")}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <FormField
            label={t("customFee")}
            value={customFee}
            onChangeText={setCustomFee}
            keyboardType="numeric"
            placeholder={t("defaultFee")}
          />
          {!editId ? (
            <DateField
              label={t("enrollmentDate")}
              value={startDate}
              onChange={setStartDate}
            />
          ) : null}

          <Text style={styles.label}>{t("group")}</Text>
          <View style={styles.wrap}>
            {groups.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => setGroupId(g.id)}
                style={[styles.chip, groupId === g.id && styles.chipOn]}
              >
                <Text style={[styles.chipText, groupId === g.id && styles.chipTextOn]}>
                  {g.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t("status")}</Text>
          <View style={styles.wrap}>
            {(
              [
                ["active", t("active")],
                ["paused", t("paused")],
                ["withdrawn", t("withdrawn")],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setStatus(key)}
                style={[styles.chip, status === key && styles.chipOn]}
              >
                <Text style={[styles.chipText, status === key && styles.chipTextOn]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
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
  wrap: {
    ...rtlChipRow(),
    gap: 8,
    marginBottom: spacing.lg,
    width: "100%",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "600", ...rtlText },
  chipTextOn: { color: "#fff" },
});
