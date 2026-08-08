import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import {
  Card,
  LoadingBlock,
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { DetailCard } from "@/src/components/DetailCard";
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import { useDialog } from "@/src/components/DialogProvider";
import { t } from "@/src/i18n/ar";
import { getAttendanceRatesByStudent } from "@/src/repositories";
import { getOpenRoundsPaymentSummary } from "@/src/services/rounds";
import { formatMoney } from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlText } from "@/src/theme/rtl";
import { useClientPagination } from "@/src/hooks/useClientPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";

export default function ReportsScreen() {
  const dialog = useDialog();
  const { pageSize } = useGeneralSettings();
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<
    { student_id: number; student_name: string; present: number; total: number }[]
  >([]);
  const [byGroup, setByGroup] = useState<
    { group_id: number; group_name: string; collected: number; remaining: number }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rates, summary] = await Promise.all([
        getAttendanceRatesByStudent(),
        getOpenRoundsPaymentSummary(),
      ]);
      setAttendance(rates);
      const map = new Map<
        number,
        { group_name: string; collected: number; remaining: number }
      >();
      for (const d of summary.dues) {
        const cur = map.get(d.group_id) ?? {
          group_name: d.group_name,
          collected: 0,
          remaining: 0,
        };
        cur.collected += d.paid;
        cur.remaining += d.remaining;
        map.set(d.group_id, cur);
      }
      setByGroup(
        [...map.entries()].map(([group_id, v]) => ({ group_id, ...v }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const attendancePage = useClientPagination(attendance, pageSize, "att");
  const groupPage = useClientPagination(byGroup, pageSize, "grp");

  async function onShare() {
    const lines = [
      t("appName"),
      "",
      t("reportAttendance"),
      ...attendance.map((a) => {
        const pct = a.total ? Math.round((a.present / a.total) * 100) : 0;
        return `${a.student_name}: ${pct}% (${a.present}/${a.total})`;
      }),
      "",
      t("reportRevenue"),
      ...byGroup.map(
        (g) =>
          `${g.group_name}: ${formatMoney(g.collected)} / متبقي ${formatMoney(g.remaining)}`
      ),
    ];
    const text = lines.join("\n");
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) throw new Error(t("error"));
    const path = `${dir}report-${Date.now()}.txt`;
    await FileSystem.writeAsStringAsync(path, text, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType: "text/plain",
        dialogTitle: t("reportShare"),
      });
      dialog.toast(t("reportShared"), "success");
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}>
        <Title>{t("reports")}</Title>
        <Muted style={{ marginBottom: spacing.md }}>{t("reportsHint")}</Muted>
        <PrimaryButton label={t("reportShare")} onPress={() => void onShare()} />

        <Text style={styles.section}>{t("reportAttendance")}</Text>
        {!attendance.length ? (
          <Muted>{t("empty")}</Muted>
        ) : (
          <>
            {attendancePage.pageItems.map((a) => {
              const pct = a.total ? Math.round((a.present / a.total) * 100) : 0;
              return (
                <Card key={a.student_id}>
                  <Text style={styles.line}>{a.student_name}</Text>
                  <Muted>
                    {t("presentRate")}: {pct}% ({a.present}/{a.total})
                  </Muted>
                </Card>
              );
            })}
            <PaginationBar {...pagingBarProps(attendancePage)} />
          </>
        )}

        <Text style={styles.section}>{t("reportRevenue")}</Text>
        {!byGroup.length ? (
          <Muted>{t("empty")}</Muted>
        ) : (
          <>
            {groupPage.pageItems.map((g) => (
              <DetailCard
                key={g.group_id}
                title={g.group_name}
                details={[
                  {
                    icon: "money",
                    label: t("payments"),
                    value: formatMoney(g.collected),
                  },
                  {
                    icon: "exclamation-circle",
                    label: t("remaining"),
                    value: formatMoney(g.remaining),
                  },
                ]}
              />
            ))}
            <PaginationBar {...pagingBarProps(groupPage)} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  line: {
    ...rtlText,
    width: "100%",
    fontFamily: fonts.bold,
    color: colors.text,
  },
});
