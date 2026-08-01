import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  FormField,
  Muted,
  PrimaryButton,
  Screen,
  SectionTitle,
} from "@/src/components/ui";
import { DateField } from "@/src/components/DateFields";
import { t } from "@/src/i18n/ar";
import { createAcademicYearWithSemesters } from "@/src/repositories";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { spacing } from "@/src/theme/colors";
import { monthsOverlappingRange, yearMonthLabel } from "@/src/utils/date";

export default function YearFormScreen() {
  const router = useRouter();
  const { bump } = useAppData();
  const dialog = useDialog();
  const [name, setName] = useState("2025/2026");
  const [sem1Start, setSem1Start] = useState("2025-10-01");
  const [sem1End, setSem1End] = useState("2025-12-31");
  const [sem2Start, setSem2Start] = useState("2026-02-01");
  const [sem2End, setSem2End] = useState("2026-04-30");
  const [saving, setSaving] = useState(false);

  const preview1 = useMemo(() => {
    try {
      return monthsOverlappingRange(sem1Start, sem1End);
    } catch {
      return [];
    }
  }, [sem1Start, sem1End]);

  const preview2 = useMemo(() => {
    try {
      return monthsOverlappingRange(sem2Start, sem2End);
    } catch {
      return [];
    }
  }, [sem2Start, sem2End]);

  async function onSave() {
    if (!name.trim()) {
      await dialog.alert({ title: t("error"), message: t("required") });
      return;
    }
    if (sem1Start > sem1End) {
      await dialog.alert({
        title: t("error"),
        message: t("invalidSemesterDates1"),
      });
      return;
    }
    if (sem2Start > sem2End) {
      await dialog.alert({
        title: t("error"),
        message: t("invalidSemesterDates2"),
      });
      return;
    }
    setSaving(true);
    try {
      await createAcademicYearWithSemesters({
        name: name.trim(),
        semester1: { start_date: sem1Start, end_date: sem1End },
        semester2: { start_date: sem2Start, end_date: sem2End },
      });
      bump();
      router.back();
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
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: 40,
            alignItems: "stretch",
          }}
          keyboardShouldPersistTaps="handled"
        >
          <FormField label={t("yearName")} value={name} onChangeText={setName} />

          <SectionTitle>{t("semester1")}</SectionTitle>
          <Muted style={{ marginBottom: spacing.sm }}>
            {t("semesterDateHint")}
          </Muted>
          <DateField
            label={t("startDate")}
            value={sem1Start}
            onChange={setSem1Start}
          />
          <DateField
            label={t("endDate")}
            value={sem1End}
            onChange={setSem1End}
          />
          <Muted style={{ marginBottom: spacing.md }}>
            {t("studyMonths")}:{" "}
            {preview1.length
              ? preview1.map((m) => yearMonthLabel(m.yearMonth)).join(" · ")
              : "—"}
          </Muted>

          <SectionTitle>{t("semester2")}</SectionTitle>
          <Muted style={{ marginBottom: spacing.sm }}>
            {t("semesterDateHint")}
          </Muted>
          <DateField
            label={t("startDate")}
            value={sem2Start}
            onChange={setSem2Start}
          />
          <DateField
            label={t("endDate")}
            value={sem2End}
            onChange={setSem2End}
          />
          <Muted style={{ marginBottom: spacing.md }}>
            {t("studyMonths")}:{" "}
            {preview2.length
              ? preview2.map((m) => yearMonthLabel(m.yearMonth)).join(" · ")
              : "—"}
          </Muted>

          <View style={{ height: 8 }} />
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
