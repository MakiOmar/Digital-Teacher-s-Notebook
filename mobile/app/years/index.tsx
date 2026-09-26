import { useCallback, useState } from "react";
import { FlatList } from "react-native";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import {
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/src/components/ui";
import { DetailCard } from "@/src/components/DetailCard";
import { useHeaderToolbar } from "@/src/components/useHeaderToolbar";
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import { t } from "@/src/i18n/ar";
import {
  deleteAcademicYear,
  listAcademicYears,
  setActiveYear,
} from "@/src/repositories";
import type { AcademicYear } from "@/src/db/types";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { useClientPagination } from "@/src/hooks/useClientPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import { colors, spacing } from "@/src/theme/colors";

export default function YearsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { bump } = useAppData();
  const { pageSize } = useGeneralSettings();
  const dialog = useDialog();
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState<AcademicYear[]>([]);

  useHeaderToolbar({
    actions: [
      {
        key: "add",
        icon: "plus",
        label: t("actionAdd"),
        tone: "accent",
        onPress: () => router.push("/years/form"),
      },
    ],
  });

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ headerTitle: t("academicYears") });
    }, [navigation])
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setYears(await listAcademicYears());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const paging = useClientPagination(years, pageSize);

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40 }}
        data={paging.pageItems}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <EmptyState
            message={t("empty")}
            actionLabel={t("createYearCta")}
            onAction={() => router.push("/years/form")}
          />
        }
        ListFooterComponent={
          <PaginationBar {...pagingBarProps(paging)} />
        }
        renderItem={({ item }) => (
          <DetailCard
            title={item.name}
            badge={
              item.is_active
                ? {
                    label: t("activeYear"),
                    color: colors.success,
                    backgroundColor: colors.paid,
                  }
                : undefined
            }
            details={[
              {
                icon: "calendar",
                label: t("startDate"),
                value: item.start_date,
              },
              {
                icon: "calendar-check-o",
                label: t("endDate"),
                value: item.end_date,
              },
            ]}
            onPress={() => {
              void (async () => {
                const choice = await dialog.pick({
                  title: item.name,
                  options: [
                    { id: "activate", label: t("activateYear") },
                    { id: "delete", label: t("delete"), destructive: true },
                  ],
                });
                if (choice === "activate") {
                  await setActiveYear(item.id);
                  bump();
                  await load();
                  return;
                }
                if (choice === "delete") {
                  const ok = await dialog.confirm({
                    title: t("delete"),
                    message: t("deleteConfirm"),
                    confirmLabel: t("delete"),
                    danger: true,
                  });
                  if (!ok) return;
                  try {
                    await deleteAcademicYear(item.id);
                    bump();
                    await load();
                  } catch (e) {
                    dialog.alert({
                      title: t("error"),
                      message:
                        e instanceof Error ? e.message : t("yearDeleteBlocked"),
                    });
                  }
                }
              })();
            }}
          />
        )}
      />
    </Screen>
  );
}
