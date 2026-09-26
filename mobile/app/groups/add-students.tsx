import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  EmptyState,
  FormField,
  Muted,
  Screen,
  SearchField,
} from "@/src/components/ui";
import { useHeaderToolbar } from "@/src/components/useHeaderToolbar";
import type { IconAction } from "@/src/components/IconActionBar";
import { t } from "@/src/i18n/ar";
import {
  assignSeatToGroup,
  enrollStudentsInGroup,
  getGroup,
  listStudentsNotInGroup,
  searchStudentsByName,
  type StudentEnrollmentRow,
} from "@/src/repositories";
import type { Student, StudyGroup } from "@/src/db/types";
import { todayDateOnly } from "@/src/utils/date";
import { colors, radii, spacing } from "@/src/theme/colors";
import {
  rtlChipRow,
  rtlRow,
  rtlText,
  inputShell,
  inputTextAlign,
  writingDirection,
} from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";
import { userFacingErrorMessage } from "@/src/utils/errors";

type Mode = "existing" | "new";

type SeatRow = {
  key: string;
  text: string;
  selectedStudentId: number | null;
};

function makeSeats(count: number, startIndex = 0): SeatRow[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `seat-${Date.now()}-${startIndex + i}-${Math.random()}`,
    text: "",
    selectedStudentId: null,
  }));
}

export default function AddStudentsToGroupScreen() {
  const { groupId: groupIdParam } = useLocalSearchParams<{ groupId: string }>();
  const groupId = Number(groupIdParam);
  const router = useRouter();
  const navigation = useNavigation();
  const { bump } = useAppData();
  const dialog = useDialog();

  const [mode, setMode] = useState<Mode>("existing");
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [available, setAvailable] = useState<StudentEnrollmentRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [seatsCountInput, setSeatsCountInput] = useState("5");
  const [seats, setSeats] = useState<SeatRow[]>(() => makeSeats(5));
  const [activeSeatKey, setActiveSeatKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const seatsScrollRef = useRef<ScrollView>(null);
  const seatOffsetY = useRef<Record<string, number>>({});

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  function scrollSeatsTo(y: number, extra = 24) {
    // Delay so layout settles after keyboard / suggestions open.
    requestAnimationFrame(() => {
      setTimeout(() => {
        seatsScrollRef.current?.scrollTo({
          y: Math.max(0, y - extra),
          animated: true,
        });
      }, 80);
    });
  }

  const reloadAvailable = useCallback(async () => {
    setAvailable(await listStudentsNotInGroup(groupId));
  }, [groupId]);

  useEffect(() => {
    void getGroup(groupId).then(setGroup);
    void reloadAvailable();
  }, [groupId, reloadAvailable]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((s) => {
      const hay = `${s.name} ${s.guardian_phone ?? ""} ${s.student_phone ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [available, query]);

  const loadSuggestions = useCallback(async (text: string) => {
    const q = text.trim();
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    setSuggestions(await searchStudentsByName(q));
  }, []);

  function toggleStudent(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const s of filtered) next.add(s.id);
      return next;
    });
  }

  function clearSelected() {
    setSelectedIds(new Set());
  }

  async function onAddSelected() {
    const ids = [...selectedIds];
    if (!ids.length) {
      await dialog.alert({ title: t("error"), message: t("atLeastOneSeat") });
      return;
    }
    const ok = await dialog.confirm({
      title: t("addStudentsToGroup"),
      message: t("addSelectedConfirm", { count: ids.length }),
      confirmLabel: t("addSelectedStudents"),
    });
    if (!ok) return;

    setSaving(true);
    try {
      await enrollStudentsInGroup(ids, groupId, todayDateOnly());
      setAvailable((prev) => prev.filter((s) => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
      bump();
      dialog.toast(t("studentsAdded"), "success");
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setSaving(false);
    }
  }

  function onGenerateSeats() {
    const n = Math.floor(Number(seatsCountInput.replace(",", ".")));
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      void dialog.alert({ title: t("error"), message: t("seatsRequired") });
      return;
    }
    setSeats(makeSeats(n));
    setActiveSeatKey(null);
    setSuggestions([]);
  }

  function addSeat() {
    setSeats((prev) => [...prev, ...makeSeats(1, prev.length)]);
  }

  function updateSeatText(key: string, text: string) {
    setSeats((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, text, selectedStudentId: null } : s
      )
    );
    setActiveSeatKey(key);
    void loadSuggestions(text);
  }

  function selectSuggestion(key: string, student: Student) {
    setSeats((prev) =>
      prev.map((s) =>
        s.key === key
          ? { ...s, text: student.name, selectedStudentId: student.id }
          : s
      )
    );
    setActiveSeatKey(null);
    setSuggestions([]);
  }

  function removeSeat(key: string) {
    setSeats((prev) =>
      prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)
    );
    if (activeSeatKey === key) {
      setActiveSeatKey(null);
      setSuggestions([]);
    }
  }

  const filledSeats = useMemo(
    () => seats.filter((s) => s.text.trim().length > 0),
    [seats]
  );

  async function onSaveSeats() {
    if (!filledSeats.length) {
      await dialog.alert({ title: t("error"), message: t("atLeastOneSeat") });
      return;
    }
    setSaving(true);
    try {
      const usedIds = new Set<number>();
      for (const seat of filledSeats) {
        let existingId = seat.selectedStudentId;
        if (existingId && usedIds.has(existingId)) {
          existingId = null;
        }
        const studentId = await assignSeatToGroup({
          group_id: groupId,
          name: seat.text,
          existing_student_id: existingId,
          start_date: todayDateOnly(),
        });
        usedIds.add(studentId);
      }
      bump();
      dialog.toast(t("studentsAdded"), "success");
      router.back();
    } catch (e) {
      await dialog.alert({
        title: t("error"),
        message: userFacingErrorMessage(e),
      });
    } finally {
      setSaving(false);
    }
  }

  const existingActions: IconAction[] = [
    {
      key: "addSelected",
      icon: "user-plus",
      label: t("addSelectedStudents"),
      tone: "accent",
      disabled: saving || selectedIds.size === 0,
      onPress: () => void onAddSelected(),
    },
    {
      key: "selectAll",
      icon: "check-square-o",
      label: t("selectAllStudents"),
      disabled: saving || !filtered.length,
      onPress: selectAllVisible,
    },
    {
      key: "clear",
      icon: "square-o",
      label: t("clearSelectedStudents"),
      disabled: saving || selectedIds.size === 0,
      onPress: clearSelected,
    },
  ];

  const newActions: IconAction[] = [
    {
      key: "seats",
      icon: "th-large",
      label: t("actionSeats"),
      tone: "accent",
      onPress: onGenerateSeats,
    },
    {
      key: "seat",
      icon: "plus",
      label: t("actionSeat"),
      onPress: addSeat,
    },
    {
      key: "save",
      icon: "save",
      label: t("actionSave"),
      disabled: saving,
      onPress: () => void onSaveSeats(),
    },
  ];

  useHeaderToolbar({
    actions: mode === "existing" ? existingActions : newActions,
  });

  useEffect(() => {
    navigation.setOptions({
      headerTitle: group?.name
        ? `${t("addStudentsToGroup")} · ${group.name}`
        : t("addStudentsToGroup"),
    });
  }, [navigation, group?.name]);

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <View style={styles.pagePad}>
        {/* Existing students vs type-new-names */}
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode("existing")}
            style={[styles.modeChip, mode === "existing" && styles.modeChipOn]}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === "existing" && styles.modeChipTextOn,
              ]}
            >
              {t("pickExistingStudents")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("new")}
            style={[styles.modeChip, mode === "new" && styles.modeChipOn]}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === "new" && styles.modeChipTextOn,
              ]}
            >
              {t("createNewStudents")}
            </Text>
          </Pressable>
        </View>
      </View>

      {mode === "existing" ? (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listPad}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder={t("searchPlaceholder")}
              />
              {selectedIds.size > 0 ? (
                <Text style={styles.selectedCount}>
                  {t("selectedStudentsCount", { count: selectedIds.size })}
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState message={t("noAvailableStudents")} />
          }
          renderItem={({ item }) => {
            const checked = selectedIds.has(item.id);
            return (
              <Pressable
                onPress={() => toggleStudent(item.id)}
                style={[styles.row, checked && styles.rowOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <FontAwesome
                  name={checked ? "check-square" : "square-o"}
                  size={20}
                  color={checked ? colors.primary : colors.textMuted}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.group_name
                      ? t("studentInOtherGroup", { name: item.group_name })
                      : t("noGroup")}
                    {item.guardian_phone ? ` · ${item.guardian_phone}` : ""}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <ScrollView
            ref={seatsScrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: spacing.lg,
              paddingBottom: Math.max(48, keyboardHeight + 32),
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            <FormField
              label={t("seatsCount")}
              value={seatsCountInput}
              onChangeText={setSeatsCountInput}
              keyboardType="numeric"
              onFocus={() => scrollSeatsTo(0, 0)}
            />

            {seats.map((seat, index) => {
              const isActive = activeSeatKey === seat.key;
              const showSuggestions =
                isActive && suggestions.length > 0 && !seat.selectedStudentId;
              const showNewHint =
                isActive &&
                seat.text.trim().length > 0 &&
                !seat.selectedStudentId &&
                suggestions.length === 0;

              return (
                <View
                  key={seat.key}
                  style={styles.seatCard}
                  onLayout={(e) => {
                    seatOffsetY.current[seat.key] = e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.seatHeader}>
                    <Text style={styles.seatTitle}>
                      {t("seatLabel")} {index + 1}
                    </Text>
                    {seats.length > 1 ? (
                      <Pressable onPress={() => removeSeat(seat.key)}>
                        <Text style={styles.remove}>{t("delete")}</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={inputShell}>
                    <TextInput
                      value={seat.text}
                      onChangeText={(text) => updateSeatText(seat.key, text)}
                      onFocus={() => {
                        setActiveSeatKey(seat.key);
                        void loadSuggestions(seat.text);
                        scrollSeatsTo(seatOffsetY.current[seat.key] ?? 0, 16);
                      }}
                      placeholder={t("studentName")}
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.input,
                        {
                          writingDirection: writingDirection(),
                          textAlign: inputTextAlign(),
                        },
                      ]}
                      textAlign={inputTextAlign()}
                    />
                  </View>

                  {seat.selectedStudentId ? (
                    <Muted style={{ marginTop: 6 }}>
                      {t("existingStudentHint")}
                    </Muted>
                  ) : null}

                  {showNewHint ? (
                    <Muted style={{ marginTop: 6 }}>
                      {t("noMatchNewStudent")}
                    </Muted>
                  ) : null}

                  {showSuggestions ? (
                    <View style={styles.suggestions}>
                      <Muted style={{ marginBottom: 4 }}>
                        {t("selectSuggestion")}
                      </Muted>
                      {suggestions.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() => selectSuggestion(seat.key, s)}
                          style={styles.suggestionRow}
                        >
                          <Text style={styles.suggestionText}>{s.name}</Text>
                          {s.guardian_phone ? (
                            <Text style={styles.suggestionMeta}>
                              {s.guardian_phone}
                            </Text>
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pagePad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  listPad: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  modeRow: {
    ...rtlRow(),
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  modeChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeChipText: {
    ...rtlText,
    fontWeight: "700",
    color: colors.text,
  },
  modeChipTextOn: {
    color: "#fff",
  },
  selectedCount: {
    ...rtlText,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  row: {
    ...rtlRow(),
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    ...rtlText,
    fontWeight: "700",
    fontSize: 15,
    color: colors.text,
  },
  rowMeta: {
    ...rtlText,
    fontSize: 12,
    color: colors.textMuted,
  },
  seatCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  seatHeader: {
    ...rtlChipRow(),
    flexWrap: "nowrap",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  seatTitle: {
    ...rtlText,
    fontWeight: "700",
    color: colors.text,
  },
  remove: {
    color: colors.danger,
    fontWeight: "600",
    ...rtlText,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.background,
    width: "100%",
  },
  suggestions: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  suggestionRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionText: {
    ...rtlText,
    fontWeight: "600",
    color: colors.text,
  },
  suggestionMeta: {
    ...rtlText,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
