import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  EmptyState,
  Screen,
  SearchField,
  SkeletonList,
} from "@/src/components/ui";
import { DetailCard } from "@/src/components/DetailCard";
import { StudentCardEdgeContacts } from "@/src/components/StudentCardEdgeContacts";
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
import { spacing, colors } from "@/src/theme/colors";
import { appIsRtl } from "@/src/theme/rtl";
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
      <Screen safeTop padded={false} style={{ flex: 1 }}>
        <SkeletonList />
      </Screen>
    );
  }

  return (
    <Screen safeTop padded={false} style={{ flex: 1 }}>
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
          // Room for half-out edge contact icons.
          paddingTop: 8,
        }}
        data={paging.pageItems}
        keyExtractor={(item) => String(item.id)}
        removeClippedSubviews={false}
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
        renderItem={({ item }) => {
          const hasContacts = Boolean(
            item.student_phone?.trim() || item.guardian_phone?.trim()
          );
          return (
          <View style={styles.cardWrap}>
            <StudentCardEdgeContacts
              studentPhone={item.student_phone}
              guardianPhone={item.guardian_phone}
            />
            <DetailCard
              title={item.name}
              // Card stays full-width; only header text clears the edge chips.
              contactEdge={hasContacts ? (appIsRtl() ? "left" : "right") : undefined}
              badge={{
                label: enrollmentStatusLabel(item.status),
                color:
                  item.status === "active"
                    ? colors.success
                    : item.status === "paused"
                      ? colors.warning
                      : colors.danger,
              }}
              details={[
                {
                  icon: "users",
                  label: t("group"),
                  value: item.group_name ?? "—",
                },
              ]}
              borderColor={colors.primary}
              onPress={() => router.push(`/students/${item.id}`)}
            />
          </View>
          );
        }}
        refreshing={paging.refreshing}
        onRefresh={() => {
          void paging.reload();
          void reloadGroups();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Extra top padding so half-out edge icons + labels are not clipped.
  // Card itself stays full content width (Screen side margins only).
  cardWrap: {
    position: "relative",
    marginTop: 28,
    overflow: "visible",
  },
});
