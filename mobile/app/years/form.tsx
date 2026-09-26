import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Muted, Screen, SectionTitle } from "@/src/components/ui";
import { useHeaderToolbar } from "@/src/components/useHeaderToolbar";
import { SelectField } from "@/src/components/FilterSelect";
import { DateField } from "@/src/components/DateFields";
import { t } from "@/src/i18n/ar";
import { createAcademicYearWithSemesters } from "@/src/repositories";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { spacing } from "@/src/theme/colors";
import {
  academicYearOptions,
  defaultAcademicYearName,
  defaultSemesterDatesForAcademicYear,
  monthsOverlappingRange,
  yearMonthLabel,
} from "@/src/utils/date";
import { userFacingErrorMessage } from "@/src/utils/errors";

function initialYearName(): string {
  return defaultAcademicYearName();
}

function initialSemesterDates() {
  return (
    defaultSemesterDatesForAcademicYear(initialYearName()) ?? {
      sem1Start: `${new Date().getFullYear()}-10-01`,
      sem1End: `${new Date().getFullYear()}-12-31`,
      sem2Start: `${new Date().getFullYear() + 1}-02-01`,
      sem2End: `${new Date().getFullYear() + 1}-04-30`,
    }
  );
}

export default function YearFormScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { bump } = useAppData();
  const dialog = useDialog();
  const yearOptions = useMemo(() => academicYearOptions(), []);
  const defaults = useMemo(() => initialSemesterDates(), []);

  const [name, setName] = useState(initialYearName);
  const [sem1Start, setSem1Start] = useState(defaults.sem1Start);
  const [sem1End, setSem1End] = useState(defaults.sem1End);
  const [sem2Start, setSem2Start] = useState(defaults.sem2Start);
  const [sem2End, setSem2End] = useState(defaults.sem2End);
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

  function onSelectYear(next: string) {
    setName(next);
    const dates = defaultSemesterDatesForAcademicYear(next);
    if (!dates) return;
    setSem1Start(dates.sem1Start);
    setSem1End(dates.sem1End);
    setSem2Start(dates.sem2Start);
    setSem2End(dates.sem2End);
  }

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
        message: userFacingErrorMessage(e),
      });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    navigation.setOptions({ headerTitle: t("addYear") });
  }, [navigation]);

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
          {/* Comment: academic year is picked from a generated list, not typed. */}
          <SelectField
            label={t("yearName")}
            value={name}
            options={yearOptions}
            onChange={onSelectYear}
            placeholder={t("selectYear")}
          />

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
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
