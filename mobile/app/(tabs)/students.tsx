import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
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
import { StudentImportModal } from "@/src/components/StudentImportModal";
import { PaginationBar, pagingBarProps } from "@/src/components/PaginationBar";
import { useDialog } from "@/src/components/DialogProvider";
import { useAppData } from "@/src/contexts/AppDataContext";
import { t } from "@/src/i18n/ar";
import {
  deleteStudents,
  listGroups,
  listStudentsWithEnrollmentPage,
} from "@/src/repositories";
import { exportStudentsSheet } from "@/src/services/studentImport";
import { useRefreshableList } from "@/src/hooks/useRefreshableList";
import { useServerPagination } from "@/src/hooks/useServerPagination";
import { useGeneralSettings } from "@/src/settings/GeneralSettingsContext";
import { spacing } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { fonts } from "@/src/theme/typography";
import { appIsRtl, rtlText } from "@/src/theme/rtl";
import { enrollmentStatusLabel } from "@/src/utils/statusLabels";
import { userFacingErrorMessage } from "@/src/utils/errors";

export default function StudentsTab() {
  const router = useRouter();
  const colors = useColors();
  const dialog = useDialog();
  const { bump } = useAppData();
  const { pageSize } = useGeneralSettings();
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
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

  const pageAllSelected =
    paging.pageItems.length > 0 &&
    paging.pageItems.every((item) => selectedIds.has(item.id));

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleStudent = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of paging.pageItems) next.add(item.id);
      return next;
    });
  }, [paging.pageItems]);

  const onExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportStudentsSheet();
      dialog.toast(t("exportStudentsDone", { count: result.count }), "success");
    } catch (e) {
      if (e instanceof Error && e.message === "EXPORT_NO_STUDENTS") {
        dialog.toast(t("exportStudentsEmpty"), "error");
      } else {
        dialog.toast(userFacingErrorMessage(e), "error");
      }
    } finally {
      setExporting(false);
    }
  }, [dialog, exporting]);

  const onDeleteSelected = useCallback(async () => {
    const ids = [...selectedIds];
    if (!ids.length || deleting) return;
    const ok = await dialog.confirm({
      title: t("delete"),
      message: t("deleteStudentsConfirm", { count: ids.length }),
      confirmLabel: t("delete"),
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const count = await deleteStudents(ids);
      bump();
      exitSelectMode();
      await paging.reload();
      dialog.toast(t("deleteStudentsDone", { count }), "success");
    } catch (e) {
      dialog.toast(userFacingErrorMessage(e), "error");
    } finally {
      setDeleting(false);
    }
  }, [bump, deleting, dialog, exitSelectMode, paging, selectedIds]);

  const toolbarActions = selectMode
    ? [
        {
          key: "done",
          icon: "check" as const,
          label: t("actionSelectDone"),
          onPress: exitSelectMode,
        },
        {
          key: "selectAll",
          icon: "check-square" as const,
          label: t("selectAllStudents"),
          disabled: paging.pageItems.length === 0 || pageAllSelected,
          onPress: selectAllOnPage,
        },
        {
          key: "clear",
          icon: "times" as const,
          label: t("clearSelectedStudents"),
          disabled: selectedIds.size === 0,
          onPress: () => setSelectedIds(new Set()),
        },
        {
          key: "delete",
          icon: "trash" as const,
          label: t("delete"),
          tone: "danger" as const,
          disabled: selectedIds.size === 0 || deleting,
          onPress: () => void onDeleteSelected(),
        },
      ]
    : [
        {
          key: "add",
          icon: "plus" as const,
          label: t("actionAdd"),
          tone: "accent" as const,
          tourId: "studentsAdd" as const,
          onPress: () => router.push("/students/form"),
        },
        {
          key: "import",
          icon: "upload" as const,
          label: t("actionImport"),
          onPress: () => setImportOpen(true),
        },
        {
          key: "export",
          icon: "download" as const,
          label: t("actionExport"),
          disabled: exporting,
          onPress: () => void onExport(),
        },
        {
          key: "select",
          icon: "check-square-o" as const,
          label: t("actionSelect"),
          disabled: paging.pageItems.length === 0,
          onPress: () => setSelectMode(true),
        },
      ];

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
        <IconActionBar actions={toolbarActions} />
        <FiltersSheet
          fields={[
            {
              key: "group",
              label: t("filterByGroup"),
              value: groupFilter,
              options: groupOptions,
              presentation: "searchable",
            },
            {
              key: "status",
              label: t("filterByStatus"),
              value: statusFilter,
              options: statusOptions,
              presentation: "checkbox",
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
        {/* How many students are checked across pages */}
        {selectMode && selectedIds.size > 0 ? (
          <Text style={[styles.selectedCount, { color: colors.primary }]}>
            {t("selectedStudentsCount", { count: selectedIds.size })}
          </Text>
        ) : null}
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
        extraData={selectMode ? selectedIds : undefined}
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
          const checked = selectedIds.has(item.id);
          return (
          <View style={styles.cardWrap}>
            {/* Hide call chips in select mode so taps only toggle the card */}
            {!selectMode ? (
              <StudentCardEdgeContacts
                studentPhone={item.student_phone}
                guardianPhone={item.guardian_phone}
              />
            ) : null}
            <DetailCard
              title={item.name}
              // Card stays full-width; only header text clears the edge chips.
              contactEdge={
                !selectMode && hasContacts
                  ? appIsRtl()
                    ? "left"
                    : "right"
                  : undefined
              }
              badge={{
                label: enrollmentStatusLabel(item.status),
                color:
                  item.status === "active"
                    ? colors.success
                    : item.status === "paused"
                      ? colors.warning
                      : colors.danger,
              }}
              trailing={
                selectMode ? (
                  <FontAwesome
                    name={checked ? "check-square" : "square-o"}
                    size={22}
                    color={checked ? colors.primary : colors.textMuted}
                  />
                ) : undefined
              }
              details={[
                {
                  icon: "users",
                  label: t("group"),
                  value: item.group_name ?? "—",
                },
              ]}
              borderColor={colors.primary}
              onPress={() =>
                selectMode
                  ? toggleStudent(item.id)
                  : router.push(`/students/${item.id}`)
              }
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
      {/* Bulk import from Excel or Google Sheets */}
      <StudentImportModal
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
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
  selectedCount: {
    ...rtlText,
    fontFamily: fonts.bold,
    marginBottom: spacing.sm,
  },
});
