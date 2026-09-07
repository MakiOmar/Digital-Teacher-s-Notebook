import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
} from "@/src/components/ui";
import { DetailCard } from "@/src/components/DetailCard";
import { ScreenWithFixedActions } from "@/src/components/ScreenWithFixedActions";
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
import { appIsRtl, rtlText } from "@/src/theme/rtl";
import { spacing, type AppColors } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { fonts } from "@/src/theme/typography";
import { formatDateTimeAr, formatMoney, formatRoundTitle } from "@/src/utils/date";
import { telUrl, whatsappUrl } from "@/src/utils/phone";
import { attendanceStatusLabel } from "@/src/utils/statusLabels";
import { shareMonthlyPerformanceWhatsApp } from "@/src/services/performanceShare";
import { userFacingErrorMessage } from "@/src/utils/errors";

const WHATSAPP_GREEN = "#25D366";

export default function StudentDetailsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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
      homework_done: number;
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
  const [enrolledGroupId, setEnrolledGroupId] = useState<number | undefined>();

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
      setEnrolledGroupId(en?.group_id);
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
      <ScreenWithFixedActions actions={[]}>
        <LoadingBlock />
      </ScreenWithFixedActions>
    );
  }

  if (!student) {
    return (
      <ScreenWithFixedActions actions={[]}>
        <Muted>{t("empty")}</Muted>
      </ScreenWithFixedActions>
    );
  }

  const guardianPhone = student.guardian_phone?.trim() || null;
  const studentPhone = student.student_phone?.trim() || null;
  const hasAnyPhone = Boolean(guardianPhone || studentPhone);
  const rtl = appIsRtl();

  async function onShareMonthly() {
    try {
      const result = await shareMonthlyPerformanceWhatsApp(
        student!,
        enrolledGroupId
      );
      if (!result.ok) {
        await dialog.alert({
          title: t("error"),
          message:
            result.reason === "no_data"
              ? t("shareNoMonthlyData")
              : t("shareNoPhone"),
        });
        return;
      }
      dialog.toast(t("success"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    }
  }

  return (
    <ScreenWithFixedActions
      actions={[
        {
          key: "share-month",
          icon: "whatsapp",
          label: t("shareMonthly"),
          tone: "accent",
          onPress: () => void onShareMonthly(),
        },
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
      floating={
        hasAnyPhone ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.fabColumn,
              rtl ? styles.fabStartRtl : styles.fabStartLtr,
              { bottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
            ]}
          >
            {studentPhone ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("callStudent")}
                  onPress={() => void Linking.openURL(telUrl(studentPhone))}
                  style={({ pressed }) => [
                    styles.fab,
                    styles.fabCall,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <FontAwesome name="phone" size={20} color="#fff" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("whatsappStudent")}
                  onPress={() => void Linking.openURL(whatsappUrl(studentPhone))}
                  style={({ pressed }) => [
                    styles.fab,
                    styles.fabWhatsApp,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <FontAwesome name="whatsapp" size={22} color="#fff" />
                </Pressable>
              </>
            ) : null}
            {guardianPhone ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("callGuardian")}
                  onPress={() => void Linking.openURL(telUrl(guardianPhone))}
                  style={({ pressed }) => [
                    styles.fab,
                    styles.fabGuardianCall,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <FontAwesome name="phone" size={20} color="#fff" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("whatsappGuardian")}
                  onPress={() =>
                    void Linking.openURL(whatsappUrl(guardianPhone))
                  }
                  style={({ pressed }) => [
                    styles.fab,
                    styles.fabWhatsApp,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <FontAwesome name="whatsapp" size={22} color="#fff" />
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null
      }
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: hasAnyPhone ? 160 : 40,
        }}
      >
        <Card>
          <Text style={styles.line}>
            {t("groups")}: {groupName}
          </Text>
          <Text style={styles.line}>
            {t("defaultFee")}: {feeLabel}
          </Text>
          {studentPhone ? (
            <Text style={styles.line}>
              {t("studentPhone")}: {studentPhone}
            </Text>
          ) : null}
          {guardianPhone ? (
            <Text style={styles.line}>
              {t("guardianPhone")}: {guardianPhone}
            </Text>
          ) : null}
          <Text style={styles.line}>
            {t("studentUnpaidSummary")}: {formatMoney(remaining)}
          </Text>
        </Card>

        <Text style={styles.section}>{t("studentAttendanceHistory")}</Text>
        {!attendance.length ? (
          <Muted>{t("noAttendanceHistory")}</Muted>
        ) : (
          attendance.map((a) => (
            <DetailCard
              key={`${a.session_id}-${a.starts_at}`}
              title={a.group_name}
              details={[
                {
                  icon: "calendar",
                  label: t("scheduleShort"),
                  value: formatDateTimeAr(a.starts_at),
                },
                {
                  icon: "info-circle",
                  label: t("filterByStatus"),
                  value: attendanceStatusLabel(a.status),
                },
                {
                  icon: "book",
                  label: t("homework"),
                  value: a.homework_done
                    ? t("homeworkDone")
                    : t("homeworkNotDone"),
                },
              ]}
            />
          ))
        )}

        <Text style={styles.section}>{t("studentPaymentHistory")}</Text>
        {!payments.length ? (
          <Muted>{t("noPaymentHistory")}</Muted>
        ) : (
          payments.map((p) => (
            <DetailCard
              key={p.id}
              title={p.group_name ?? t("payments")}
              right={formatMoney(p.amount)}
              details={[
                ...(p.group_name
                  ? [
                      {
                        icon: "users" as const,
                        label: t("group"),
                        value: p.group_name,
                      },
                    ]
                  : []),
                ...(p.round_number != null
                  ? [
                      {
                        icon: "calendar" as const,
                        label: t("selectMonth"),
                        value: formatRoundTitle(
                          p.round_number,
                          null,
                          null,
                          t("roundUntilOngoing")
                        ),
                      },
                    ]
                  : []),
                {
                  icon: "money",
                  label: t("payments"),
                  value: formatMoney(p.amount),
                },
                {
                  icon: "calendar-check-o",
                  label: t("paidAt"),
                  value: p.paid_at,
                },
              ]}
            />
          ))
        )}
      </ScrollView>
    </ScreenWithFixedActions>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  fabColumn: {
    position: "absolute",
    gap: 12,
    zIndex: 5,
  },
  fabStartLtr: {
    left: spacing.lg,
  },
  fabStartRtl: {
    right: spacing.lg,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#0F172A",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabCall: {
    backgroundColor: colors.primary,
  },
  fabGuardianCall: {
    backgroundColor: colors.accent,
  },
  fabWhatsApp: {
    backgroundColor: WHATSAPP_GREEN,
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
}
