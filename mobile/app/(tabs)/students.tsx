import { useCallback, useMemo, useState } from "react";
import { FlatList, Linking, Pressable, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import {
  EmptyState,
  ListRow,
  Screen,
  SearchField,
  SkeletonList,
} from "@/src/components/ui";
import { FiltersSheet } from "@/src/components/FilterSelect";
import { IconActionBar } from "@/src/components/IconActionBar";
import { PaginationBar } from "@/src/components/PaginationBar";
import { t } from "@/src/i18n/ar";
import { listStudentsWithEnrollment } from "@/src/repositories";
import { useRefreshableList } from "@/src/hooks/useRefreshableList";
import { useClientPagination } from "@/src/hooks/useClientPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import { telUrl } from "@/src/utils/phone";
import { spacing, colors } from "@/src/theme/colors";

export default function StudentsTab() {
  const router = useRouter();
  const { pageSize } = useGeneralSettings();
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const fetcher = useCallback(() => listStudentsWithEnrollment(), []);
  const { data: rows, loading, refreshing, reload } =
    useRefreshableList(fetcher);

  const groupOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) {
      if (r.group_id != null && r.group_name) {
        map.set(r.group_id, r.group_name);
      }
    }
    return [
      { value: "all", label: t("filterAllGroups") },
      ...[...map.entries()].map(([id, name]) => ({
        value: String(id),
        label: name,
      })),
    ];
  }, [rows]);

  const statusOptions = useMemo(
    () => [
      { value: "all", label: t("filterAllStatuses") },
      { value: "active", label: t("active") },
      { value: "paused", label: t("paused") },
      { value: "withdrawn", label: t("withdrawn") },
    ],
    []
  );

  const filtered = useMemo(() => {
    let list = rows;
    const q = query.trim();
    if (q) list = list.filter((r) => r.name.includes(q));
    if (groupFilter !== "all") {
      const gid = Number(groupFilter);
      list = list.filter((r) => r.group_id === gid);
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    return list;
  }, [rows, query, groupFilter, statusFilter]);

  const resetKey = `${query.trim()}:${groupFilter}:${statusFilter}`;
  const paging = useClientPagination(filtered, pageSize, resetKey);

  if (loading) {
    return (
      <Screen padded={false} style={{ flex: 1 }}>
        <SkeletonList />
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
              tourId: "studentsAdd",
              onPress: () => router.push("/students/form"),
            },
          ]}
        />
        <FiltersSheet
          fields={[
            {
              key: "group",
              label: t("filterByGroup"),
              value: groupFilter,
              options: groupOptions,
            },
            {
              key: "status",
              label: t("filterByStatus"),
              value: statusFilter,
              options: statusOptions,
            },
          ]}
          onApply={(next) => {
            setGroupFilter(next.group ?? "all");
            setStatusFilter(next.status ?? "all");
          }}
        />
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchPlaceholder")}
        />
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
        }}
        data={paging.pageItems}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <EmptyState
            message={t("noStudents")}
            actionLabel={t("addStudentCta")}
            onAction={() => router.push("/students/form")}
          />
        }
        ListFooterComponent={
          <PaginationBar
            page={paging.page}
            totalPages={paging.totalPages}
            totalItems={paging.totalItems}
            pageSize={paging.pageSize}
            hasPrev={paging.hasPrev}
            hasNext={paging.hasNext}
            onPrev={paging.prevPage}
            onNext={paging.nextPage}
          />
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${item.group_name ?? "—"}${item.guardian_phone ? ` · ${item.guardian_phone}` : ""}`}
            right={
              item.status === "active"
                ? t("active")
                : item.status === "paused"
                  ? t("paused")
                  : item.status === "withdrawn"
                    ? t("withdrawn")
                    : item.status
            }
            borderColor={colors.primary}
            onPress={() => router.push(`/students/${item.id}`)}
            trailing={
              item.guardian_phone ? (
                <Pressable
                  onPress={() => {
                    void Linking.openURL(telUrl(item.guardian_phone!));
                  }}
                  hitSlop={10}
                  accessibilityLabel={t("callGuardian")}
                  style={{ padding: 6 }}
                >
                  <FontAwesome name="phone" size={18} color={colors.success} />
                </Pressable>
              ) : null
            }
          />
        )}
        refreshing={refreshing}
        onRefresh={() => void reload()}
      />
    </Screen>
  );
}
