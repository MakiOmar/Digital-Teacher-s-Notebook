import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  FormField,
  Muted,
  PrimaryButton,
  Screen,
  Title,
} from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import {
  assignSeatToGroup,
  getGroup,
  searchStudentsByName,
} from "@/src/repositories";
import type { Student, StudyGroup } from "@/src/db/types";
import { todayDateOnly } from "@/src/utils/date";
import { colors, spacing } from "@/src/theme/colors";
import { rtlChipRow, rtlText, inputShell, inputTextAlign } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";
import { useDialog } from "@/src/components/DialogProvider";

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
  const { bump } = useAppData();
  const dialog = useDialog();

  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [seatsCountInput, setSeatsCountInput] = useState("5");
  const [seats, setSeats] = useState<SeatRow[]>(() => makeSeats(5));
  const [activeSeatKey, setActiveSeatKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getGroup(groupId).then(setGroup);
  }, [groupId]);

  const loadSuggestions = useCallback(async (text: string) => {
    const q = text.trim();
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    setSuggestions(await searchStudentsByName(q));
  }, []);

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
        s.key === key
          ? { ...s, text, selectedStudentId: null }
          : s
      )
    );
    setActiveSeatKey(key);
    void loadSuggestions(text);
  }

  function selectSuggestion(key: string, student: Student) {
    setSeats((prev) =>
      prev.map((s) =>
        s.key === key
          ? {
              ...s,
              text: student.name,
              selectedStudentId: student.id,
            }
          : s
      )
    );
    setActiveSeatKey(null);
    setSuggestions([]);
  }

  function removeSeat(key: string) {
    setSeats((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
    if (activeSeatKey === key) {
      setActiveSeatKey(null);
      setSuggestions([]);
    }
  }

  const filledSeats = useMemo(
    () => seats.filter((s) => s.text.trim().length > 0),
    [seats]
  );

  async function onSave() {
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
        // If user typed an exact match later without selecting, try reuse by id already set only
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
        message: e instanceof Error ? e.message : t("error"),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Title>{t("addStudentsToGroup")}</Title>
          <Muted style={{ marginBottom: spacing.md }}>
            {group?.name ?? "—"}
          </Muted>

          <FormField
            label={t("seatsCount")}
            value={seatsCountInput}
            onChangeText={setSeatsCountInput}
            keyboardType="numeric"
          />
          <View style={{ gap: 10, marginBottom: spacing.lg }}>
            <PrimaryButton
              label={t("generateSeats")}
              onPress={onGenerateSeats}
            />
            <PrimaryButton
              label={t("addMoreSeat")}
              variant="ghost"
              onPress={addSeat}
            />
          </View>

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
              <View key={seat.key} style={styles.seatCard}>
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
                    }}
                    placeholder={t("studentName")}
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
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

          <PrimaryButton
            label={saving ? t("loading") : t("saveStudents")}
            onPress={() => void onSave()}
            disabled={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    textAlign: "right",
    writingDirection: "rtl",
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
