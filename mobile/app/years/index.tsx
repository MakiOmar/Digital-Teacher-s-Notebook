import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  EmptyState,
  ListRow,
  LoadingBlock,
  Screen,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
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
import { spacing } from "@/src/theme/colors";

export default function YearsScreen() {
  const router = useRouter();
  const { bump } = useAppData();
  const { pageSize } = useGeneralSettings();
  const dialog = useDialog();
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState<AcademicYear[]>([]);

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
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <IconActionBar
          actions={[
            {
              key: "add",
              icon: "plus",
              label: t("actionAdd"),
              tone: "accent",
              onPress: () => router.push("/years/form"),
            },
          ]}
        />
      </View>
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
          <ListRow
            title={item.name}
            subtitle={`${item.start_date} → ${item.end_date}`}
            right={item.is_active ? t("activeYear") : undefined}
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
                  await deleteAcademicYear(item.id);
                  bump();
                  await load();
                }
              })();
            }}
          />
        )}
      />
    </Screen>
  );
}
