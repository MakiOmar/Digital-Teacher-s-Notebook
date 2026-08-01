import { useCallback, useState } from "react";
import { ScrollView, Text } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Card,
  LoadingBlock,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { t } from "@/src/i18n/ar";
import {
  deleteStudent,
  getActiveEnrollment,
  getStudent,
} from "@/src/repositories";
import type { Student } from "@/src/db/types";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { rtlText } from "@/src/theme/rtl";

export default function StudentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = Number(id);
  const router = useRouter();
  const { bump } = useAppData();
  const dialog = useDialog();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [groupName, setGroupName] = useState("—");
  const [feeLabel, setFeeLabel] = useState("—");

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
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading || !student) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView>
        <IconActionBar
          actions={[
            {
              key: "edit",
              icon: "pencil",
              label: t("edit"),
              tone: "accent",
              onPress: () =>
                router.push({
                  pathname: "/students/form",
                  params: { id: String(studentId) },
                }),
            },
            {
              key: "pay",
              icon: "money",
              label: t("actionPay"),
              onPress: () => {
                void (async () => {
                  const en = await getActiveEnrollment(studentId);
                  if (en?.group_id) {
                    router.push(
                      `/groups/round-payments?groupId=${en.group_id}` as never
                    );
                  }
                })();
              },
            },
            {
              key: "delete",
              icon: "trash",
              label: t("delete"),
              tone: "danger",
              onPress: () => {
                void (async () => {
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
                })();
              },
            },
          ]}
        />
        <Title>{student.name}</Title>
        <Card>
          <Text style={rtlText}>
            {t("guardianPhone")}: {student.guardian_phone || "—"}
          </Text>
          <Muted>
            {t("group")}: {groupName}
          </Muted>
          <Muted>
            {t("customFee")}: {feeLabel}
          </Muted>
          <Muted>
            {t("status")}: {student.status}
          </Muted>
          {student.notes ? <Muted>{student.notes}</Muted> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}
