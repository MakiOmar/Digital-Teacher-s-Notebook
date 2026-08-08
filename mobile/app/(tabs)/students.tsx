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
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import { t } from "@/src/i18n/ar";
import {
  listGroups,
  listStudentsWithEnrollmentPage,
} from "@/src/repositories";
import { useRefreshableList } from "@/src/hooks/useRefreshableList";
import { useServerPagination } from "@/src/hooks/useServerPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import { telUrl } from "@/src/utils/phone";
import { spacing, colors } from "@/src/theme/colors";
import { enrollmentStatusLabel } from "@/src/utils/statusLabels";

export default function StudentsTab() {
  const router = useRouter();
  const { pageSize } = useGeneralSettings();
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const groupsFetcher = useCallback(() => listGroups(), []);
  const { data: groups, reload: reloadGroups } =
    useRefreshableList(groupsFetcher);

  const groupOptions = useMemo(() => {
    return [
      { value: "all", label: t("filterAllGroups") },
      ...groups.map((group) => ({
        value: String(group.id),
        label: group.name,
      })),
    ];
  }, [groups]);

  const statusOptions = useMemo(
    () => [
      { value: "all", label: t("filterAllStatuses") },
      { value: "active", label: t("active") },
      { value: "paused", label: t("paused") },
      { value: "withdrawn", label: t("withdrawn") },
    ],
    []
  );

  const resetKey = `${query.trim()}:${groupFilter}:${statusFilter}`;
  const fetchPage = useCallback(
    (limit: number, offset: number) =>
      listStudentsWithEnrollmentPage({
        query,
        groupId: groupFilter === "all" ? undefined : Number(groupFilter),
        status: statusFilter === "all" ? undefined : statusFilter,
        limit,
        offset,
      }),
    [groupFilter, query, statusFilter]
  );
  const paging = useServerPagination(fetchPage, pageSize, resetKey);

  if (paging.loading) {
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
          <PaginationBar {...pagingBarProps(paging)} />
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${item.group_name ?? "—"}${item.guardian_phone ? ` · ${item.guardian_phone}` : ""}`}
            right={enrollmentStatusLabel(item.status)}
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
        refreshing={paging.refreshing}
        onRefresh={() => {
          void paging.reload();
          void reloadGroups();
        }}
      />
    </Screen>
  );
}
