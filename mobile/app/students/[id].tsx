import { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import {
  Card,
  LoadingBlock,
  Muted,
  PrimaryButton,
  Screen,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { t } from "@/src/i18n/ar";
import {
  deleteStudent,
  getActiveEnrollment,
  getStudent,
  getStudentOpenRemaining,
  listStudentAttendanceHistory,
  listStudentPayments,
} from "@/src/repositories";
import type { Student } from "@/src/db/types";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { rtlText } from "@/src/theme/rtl";
import { colors, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { formatDateTimeAr, formatMoney, formatRoundTitle } from "@/src/utils/date";
import { telUrl, whatsappUrl } from "@/src/utils/phone";

function attendanceLabel(status: string): string {
  if (status === "present") return t("present");
  if (status === "absent_excused") return t("absentExcused");
  if (status === "absent_unexcused") return t("absentUnexcused");
  return status;
}

export default function StudentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const { bump } = useAppData();
  const dialog = useDialog();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [groupName, setGroupName] = useState("—");
  const [feeLabel, setFeeLabel] = useState("—");
  const [remaining, setRemaining] = useState(0);
  const [attendance, setAttendance] = useState<
    {
      session_id: number;
      starts_at: string;
      group_name: string;
      status: string;
    }[]
  >([]);
  const [payments, setPayments] = useState<
    {
      id: number;
      amount: number;
      paid_at: string;
      group_name: string | null;
      round_number: number | null;
    }[]
  >([]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: student?.name || t("students"),
    });
  }, [navigation, student?.name]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getStudent(studentId);
      setStudent(s);
      const en = await getActiveEnrollment(studentId);
      setGroupName(en?.group_name ?? "—");
      setFeeLabel(
        en?.custom_monthly_fee != null
          ? String(en.custom_monthly_fee)
          : t("defaultFee")
      );
      const [att, pays, rem] = await Promise.all([
        listStudentAttendanceHistory(studentId),
        listStudentPayments(studentId),
        getStudentOpenRemaining(studentId),
      ]);
      setAttendance(att);
      setPayments(pays);
      setRemaining(rem);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function onDelete() {
    const ok = await dialog.confirm({
      title: t("delete"),
      message: t("deleteConfirm"),
      confirmLabel: t("delete"),
      danger: true,
    });
    if (!ok) return;
    await deleteStudent(studentId);
    bump();
    router.back();
  }

  if (loading && !student) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  if (!student) {
    return (
      <Screen>
        <Muted>{t("empty")}</Muted>
      </Screen>
    );
  }

  const phone = student.guardian_phone?.trim() || null;

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      {/* Fixed top: edit / delete only */}
      <View style={styles.fixedActions}>
        <IconActionBar
          actions={[
            {
              key: "edit",
              icon: "pencil",
              label: t("edit"),
              onPress: () =>
                router.push(`/students/form?id=${student.id}` as never),
            },
            {
              key: "delete",
              icon: "trash",
              label: t("delete"),
              tone: "danger",
              onPress: () => void onDelete(),
            },
          ]}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 40,
        }}
      >
        <Card>
          <Text style={styles.line}>
            {t("groups")}: {groupName}
          </Text>
          <Text style={styles.line}>
            {t("defaultFee")}: {feeLabel}
          </Text>
          {phone ? (
            <Text style={styles.line}>
              {t("guardianPhone")}: {phone}
            </Text>
          ) : null}
          <Text style={styles.line}>
            {t("studentUnpaidSummary")}: {formatMoney(remaining)}
          </Text>
        </Card>

        {phone ? (
          <View style={{ gap: 10, marginBottom: spacing.lg }}>
            <PrimaryButton
              label={t("callGuardian")}
              onPress={() => void Linking.openURL(telUrl(phone))}
            />
            <PrimaryButton
              label={t("whatsappGuardian")}
              variant="ghost"
              onPress={() => {
                void Linking.openURL(whatsappUrl(phone));
              }}
            />
          </View>
        ) : null}

        <Text style={styles.section}>{t("studentAttendanceHistory")}</Text>
        {!attendance.length ? (
          <Muted>{t("noAttendanceHistory")}</Muted>
        ) : (
          attendance.map((a) => (
            <Card key={`${a.session_id}-${a.starts_at}`}>
              <Text style={styles.line}>{a.group_name}</Text>
              <Muted>
                {formatDateTimeAr(a.starts_at)} · {attendanceLabel(a.status)}
              </Muted>
            </Card>
          ))
        )}

        <Text style={styles.section}>{t("studentPaymentHistory")}</Text>
        {!payments.length ? (
          <Muted>{t("noPaymentHistory")}</Muted>
        ) : (
          payments.map((p) => (
            <Card key={p.id}>
              <Text style={styles.line}>
                {formatMoney(p.amount)}
                {p.group_name ? ` · ${p.group_name}` : ""}
              </Text>
              <Muted>
                {p.paid_at}
                {p.round_number != null
                  ? ` · ${formatRoundTitle(p.round_number, null, null, t("roundUntilOngoing"))}`
                  : ""}
              </Muted>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fixedActions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 0,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    zIndex: 2,
  },
  line: {
    ...rtlText,
    width: "100%",
    color: colors.text,
    marginBottom: 4,
    fontFamily: fonts.semiBold,
  },
  section: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
