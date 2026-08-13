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
import AsyncStorage from "@react-native-async-storage/async-storage";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { FormField, Screen } from "@/src/components/ui";
import { SelectField } from "@/src/components/FilterSelect";
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
import { pickContactPhone } from "@/src/utils/contacts";
import { colors, radii, spacing } from "@/src/theme/colors";
import { rtlChipRow, rtlRow, rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { userFacingErrorMessage } from "@/src/utils/errors";

const LAST_GROUP_KEY = "tutor.lastStudentGroupId.v1";

type PhoneTarget = "guardian" | "student";

export default function StudentFormScreen() {
  const { id, groupId: groupIdParam } = useLocalSearchParams<{
    id?: string;
    groupId?: string;
  }>();
  const editId = id ? Number(id) : null;
  const presetGroupId = groupIdParam ? Number(groupIdParam) : null;
  const router = useRouter();
  const navigation = useNavigation();
  const { bump } = useAppData();
  const dialog = useDialog();

  const [name, setName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");
  const [customFee, setCustomFee] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [startDate, setStartDate] = useState(todayDateOnly());
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(Boolean(editId));

  useEffect(() => {
    navigation.setOptions({
      title: editId ? t("editStudent") : t("addStudent"),
    });
  }, [editId, navigation]);

  useEffect(() => {
    void (async () => {
      const g = await listGroups();
      setGroups(g);

      if (editId) {
        const s = await getStudent(editId);
        if (!s) return;
        setName(s.name);
        setStudentPhone(s.student_phone ?? "");
        setGuardianPhone(s.guardian_phone ?? "");
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
        return;
      }

      // New student: URL group wins, else last used — never force a group.
      if (presetGroupId && g.some((x) => x.id === presetGroupId)) {
        setGroupId(presetGroupId);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(LAST_GROUP_KEY);
        const lastId = raw ? Number(raw) : NaN;
        if (Number.isFinite(lastId) && g.some((x) => x.id === lastId)) {
          setGroupId(lastId);
        }
      } catch {
        // ignore storage errors
      }
    })();
  }, [editId, presetGroupId]);

  function resetForNextEntry(keepGroupId: number | null) {
    setName("");
    setStudentPhone("");
    setGuardianPhone("");
    setNotes("");
    setCustomFee("");
    setStatus("active");
    setStartDate(todayDateOnly());
    setGroupId(keepGroupId);
    setMoreOpen(false);
  }

  async function pickPhone(target: PhoneTarget) {
    try {
      const picked = await pickContactPhone();
      if (!picked) return;
      if (target === "guardian") {
        setGuardianPhone(picked.phone ?? "");
        // Fill empty student name from guardian contact when adding.
        if (!editId && !name.trim() && picked.name) {
          setName(picked.name);
        }
      } else {
        setStudentPhone(picked.phone ?? "");
        if (!editId && !name.trim() && picked.name) {
          setName(picked.name);
        }
      }
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "CONTACTS_PERMISSION_DENIED"
          ? t("contactsPermissionDenied")
          : userFacingErrorMessage(e);
      await dialog.alert({ title: t("error"), message: msg });
    }
  }

  async function onSave(addAnother: boolean) {
    if (!name.trim()) {
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
          student_phone: studentPhone.trim() || null,
          guardian_phone: guardianPhone.trim() || null,
          notes: notes.trim() || null,
          status,
          group_id: groupId,
          custom_monthly_fee: feeVal,
        });
        if (groupId != null) {
          await AsyncStorage.setItem(LAST_GROUP_KEY, String(groupId)).catch(
            () => undefined
          );
        }
        bump();
        dialog.toast(t("success"), "success");
        router.back();
        return;
      }

      await createStudent({
        name: name.trim(),
        student_phone: studentPhone.trim() || null,
        guardian_phone: guardianPhone.trim() || null,
        notes: notes.trim() || null,
        status,
        group_id: groupId,
        custom_monthly_fee: groupId != null ? feeVal : null,
        start_date: startDate,
      });
      if (groupId != null) {
        await AsyncStorage.setItem(LAST_GROUP_KEY, String(groupId)).catch(
          () => undefined
        );
      }
      bump();
      dialog.toast(t("studentSaved"), "success");

      if (addAnother) {
        resetForNextEntry(groupId);
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
          <IconActionBar
            actions={[
              {
                key: "save",
                icon: "save",
                label: t("actionSave"),
                tone: "accent",
                disabled: saving,
                onPress: () => void onSave(false),
              },
              ...(!editId
                ? [
                    {
                      key: "saveAnother",
                      icon: "plus" as const,
                      label: t("saveAndAddAnother"),
                      tone: "default" as const,
                      disabled: saving,
                      onPress: () => void onSave(true),
                    },
                  ]
                : []),
            ]}
          />

          {/* Essentials: name, parent phone; group is optional */}
          <FormField
            label={t("studentName")}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>{t("guardianPhone")}</Text>
          <View style={styles.phoneRow}>
            <View style={styles.phoneField}>
              <FormField
                label=""
                value={guardianPhone}
                onChangeText={setGuardianPhone}
                keyboardType="phone-pad"
                placeholder={t("guardianPhoneHint")}
              />
            </View>
            <Pressable
              onPress={() => void pickPhone("guardian")}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={t("pickFromContacts")}
              style={({ pressed }) => [
                styles.contactBtn,
                pressed && { opacity: 0.75 },
              ]}
            >
              <FontAwesome name="address-book" size={18} color={colors.primary} />
              <Text style={styles.contactBtnText} numberOfLines={1}>
                {t("pickFromContacts")}
              </Text>
            </Pressable>
          </View>

          {/* Searchable dropdown — chips do not scale with many groups */}
          <SelectField
            label={t("groupOptional")}
            value={groupId == null ? "" : String(groupId)}
            options={[
              { value: "", label: t("noGroup") },
              ...groups.map((g) => ({
                value: String(g.id),
                label: g.name,
              })),
            ]}
            onChange={(next) => setGroupId(next ? Number(next) : null)}
            placeholder={t("noGroup")}
            searchable
          />

          {/* Optional fields collapsed for faster entry */}
          <Pressable
            onPress={() => setMoreOpen((v) => !v)}
            style={styles.moreToggle}
            accessibilityRole="button"
          >
            <Text style={styles.moreToggleText}>
              {moreOpen ? t("hideMoreOptions") : t("showMoreOptions")}
            </Text>
            <FontAwesome
              name={moreOpen ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.primary}
            />
          </Pressable>

          {moreOpen ? (
            <View>
              <Text style={styles.label}>{t("studentPhone")}</Text>
              <View style={styles.phoneRow}>
                <View style={styles.phoneField}>
                  <FormField
                    label=""
                    value={studentPhone}
                    onChangeText={setStudentPhone}
                    keyboardType="phone-pad"
                  />
                </View>
                <Pressable
                  onPress={() => void pickPhone("student")}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={t("pickFromContacts")}
                  style={({ pressed }) => [
                    styles.contactBtn,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <FontAwesome
                    name="address-book"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.contactBtnText} numberOfLines={1}>
                    {t("pickFromContacts")}
                  </Text>
                </Pressable>
              </View>

              <FormField
                label={t("notes")}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
              {groupId != null ? (
                <>
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
                </>
              ) : null}

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
                    <Text
                      style={[
                        styles.chipText,
                        status === key && styles.chipTextOn,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
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
  phoneRow: {
    ...rtlRow(),
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  phoneField: {
    flex: 1,
    minWidth: 0,
  },
  contactBtn: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 76,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  contactBtnText: {
    ...rtlText,
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
  moreToggle: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  moreToggleText: {
    ...rtlText,
    fontWeight: "700",
    color: colors.primary,
  },
});
