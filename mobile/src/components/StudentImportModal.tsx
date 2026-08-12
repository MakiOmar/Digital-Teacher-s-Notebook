/**
 * Modal to import students from an Excel/CSV file or a public Google Sheet.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { FormField } from "@/src/components/ui";
import { useDialog } from "@/src/components/DialogProvider";
import { t } from "@/src/i18n/ar";
import { listGroups } from "@/src/repositories";
import type { StudyGroup } from "@/src/db/types";
import {
  importParsedStudents,
  parseStudentsFromFileUri,
  parseStudentsFromGoogleSheetsUrl,
  pickStudentSheetFile,
  type ParsedStudentRow,
} from "@/src/services/studentImport";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlRow, rtlText } from "@/src/theme/rtl";
import { userFacingErrorMessage } from "@/src/utils/errors";

type Step = "choose" | "google" | "preview";

type Props = {
  visible: boolean;
  onClose: () => void;
  onImported: () => void;
};

function mapImportError(code: string): string {
  switch (code) {
    case "IMPORT_MISSING_NAME_COLUMN":
      return t("importMissingNameColumn");
    case "IMPORT_SHEETS_URL_REQUIRED":
      return t("importSheetsUrlRequired");
    case "IMPORT_SHEETS_URL_INVALID":
      return t("importSheetsUrlInvalid");
    case "IMPORT_SHEETS_FETCH_FAILED":
      return t("importSheetsFetchFailed");
    case "IMPORT_SHEETS_NOT_PUBLIC":
      return t("importSheetsNotPublic");
    default:
      return code;
  }
}

export function StudentImportModal({ visible, onClose, onImported }: Props) {
  const dialog = useDialog();
  const [step, setStep] = useState<Step>("choose");
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [rows, setRows] = useState<ParsedStudentRow[]>([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const validRows = useMemo(
    () => rows.filter((r) => !r.error && r.name.trim()),
    [rows]
  );
  const errorRows = useMemo(() => rows.filter((r) => r.error), [rows]);

  useEffect(() => {
    if (!visible) return;
    setStep("choose");
    setSheetsUrl("");
    setRows([]);
    setSourceLabel("");
    setLoading(false);
    setImporting(false);
    void (async () => {
      const g = await listGroups();
      setGroups(g);
      setGroupId(g[0]?.id ?? null);
    })();
  }, [visible]);

  const close = () => {
    if (loading || importing) return;
    onClose();
  };

  const goPreview = (parsedRows: ParsedStudentRow[], label: string) => {
    setRows(parsedRows);
    setSourceLabel(label);
    setStep("preview");
  };

  const onPickExcel = async () => {
    try {
      setLoading(true);
      const file = await pickStudentSheetFile();
      if (!file) return;
      const parsed = await parseStudentsFromFileUri(file.uri, file.name);
      if (!parsed.rows.length) {
        dialog.toast(t("importNoRows"), "error");
        return;
      }
      goPreview(parsed.rows, file.name);
    } catch (e) {
      const msg =
        e instanceof Error && e.message.startsWith("IMPORT_")
          ? mapImportError(e.message)
          : userFacingErrorMessage(e);
      dialog.toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const onFetchSheets = async () => {
    try {
      setLoading(true);
      const parsed = await parseStudentsFromGoogleSheetsUrl(sheetsUrl);
      if (!parsed.rows.length) {
        dialog.toast(t("importNoRows"), "error");
        return;
      }
      goPreview(parsed.rows, t("importFromGoogleSheets"));
    } catch (e) {
      const msg =
        e instanceof Error && e.message.startsWith("IMPORT_")
          ? mapImportError(e.message)
          : userFacingErrorMessage(e);
      dialog.toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const onConfirmImport = async () => {
    if (groupId == null) {
      dialog.toast(t("importSelectGroup"), "error");
      return;
    }
    if (!validRows.length) {
      dialog.toast(t("importNoValidRows"), "error");
      return;
    }
    const ok = await dialog.confirm({
      title: t("importStudents"),
      message: t("importConfirmCount", { count: validRows.length }),
      confirmLabel: t("actionImport"),
    });
    if (!ok) return;

    try {
      setImporting(true);
      const result = await importParsedStudents(validRows, {
        defaultGroupId: groupId,
        groups,
      });
      if (result.imported > 0) {
        dialog.toast(
          t("importDoneCount", { count: result.imported }),
          "success"
        );
        onImported();
        onClose();
      } else {
        dialog.toast(t("importNoneImported"), "error");
      }
      if (result.skipped > 0 && result.imported > 0) {
        await dialog.alert({
          title: t("importStudents"),
          message: t("importPartialSkipped", { count: result.skipped }),
        });
      }
    } catch (e) {
      dialog.toast(userFacingErrorMessage(e), "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      {/* Dimmed backdrop */}
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t("importStudents")}</Text>
            <Pressable
              onPress={close}
              disabled={loading || importing}
              accessibilityLabel={t("cancel")}
              hitSlop={8}
            >
              <FontAwesome name="times" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {(loading || importing) && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>
                {importing ? t("importingStudents") : t("loading")}
              </Text>
            </View>
          )}

          {step === "choose" && !loading && (
            <View style={styles.body}>
              <Text style={styles.hint}>{t("importStudentsHint")}</Text>

              {/* Excel / CSV upload */}
              <Pressable
                style={styles.option}
                onPress={() => void onPickExcel()}
              >
                <FontAwesome
                  name="file-excel-o"
                  size={22}
                  color={colors.primary}
                />
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>
                    {t("importFromExcel")}
                  </Text>
                  <Text style={styles.optionSub}>
                    {t("importFromExcelHint")}
                  </Text>
                </View>
                <FontAwesome
                  name="chevron-left"
                  size={14}
                  color={colors.textMuted}
                />
              </Pressable>

              {/* Google Sheets */}
              <Pressable
                style={styles.option}
                onPress={() => setStep("google")}
              >
                <FontAwesome name="google" size={22} color={colors.primary} />
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>
                    {t("importFromGoogleSheets")}
                  </Text>
                  <Text style={styles.optionSub}>
                    {t("importFromGoogleSheetsHint")}
                  </Text>
                </View>
                <FontAwesome
                  name="chevron-left"
                  size={14}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          )}

          {step === "google" && !loading && (
            <View style={styles.body}>
              <Text style={styles.hint}>{t("importSheetsUrlHint")}</Text>
              {/* Google Sheets share URL */}
              <FormField
                label={t("importSheetsUrlLabel")}
                value={sheetsUrl}
                onChangeText={setSheetsUrl}
                placeholder="https://docs.google.com/spreadsheets/..."
              />
              <View style={styles.actions}>
                <Pressable
                  style={[styles.btn, styles.btnGhost]}
                  onPress={() => setStep("choose")}
                >
                  <Text style={styles.btnGhostText}>{t("back")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => void onFetchSheets()}
                >
                  <Text style={styles.btnPrimaryText}>{t("confirm")}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === "preview" && !loading && (
            <View style={styles.body}>
              <Text style={styles.hint}>
                {sourceLabel
                  ? t("importPreviewFrom", { name: sourceLabel })
                  : t("importPreview")}
              </Text>
              <Text style={styles.stats}>
                {t("importPreviewStats", {
                  valid: validRows.length,
                  errors: errorRows.length,
                })}
              </Text>

              <Text style={styles.sectionLabel}>{t("importDefaultGroup")}</Text>
              <Text style={styles.sectionHint}>
                {t("importDefaultGroupHint")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.groupChips}
              >
                {groups.map((g) => {
                  const selected = g.id === groupId;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => setGroupId(g.id)}
                      style={[
                        styles.chip,
                        selected && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {g.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Preview list */}
              <ScrollView style={styles.previewList}>
                {rows.slice(0, 40).map((row) => (
                  <View
                    key={`${row.rowNumber}-${row.name}`}
                    style={styles.previewRow}
                  >
                    <Text
                      style={[
                        styles.previewName,
                        row.error ? styles.previewError : null,
                      ]}
                      numberOfLines={1}
                    >
                      {row.name || t("importRowMissingName")}
                    </Text>
                    <Text style={styles.previewMeta} numberOfLines={1}>
                      {row.group_name || t("importUsesDefaultGroup")}
                      {row.guardian_phone ? ` · ${row.guardian_phone}` : ""}
                    </Text>
                  </View>
                ))}
                {rows.length > 40 ? (
                  <Text style={styles.moreRows}>
                    {t("importMoreRows", { count: rows.length - 40 })}
                  </Text>
                ) : null}
              </ScrollView>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.btn, styles.btnGhost]}
                  onPress={() => {
                    setRows([]);
                    setStep("choose");
                  }}
                  disabled={importing}
                >
                  <Text style={styles.btnGhostText}>{t("back")}</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.btn,
                    styles.btnPrimary,
                    (!validRows.length || importing) && { opacity: 0.5 },
                  ]}
                  onPress={() => void onConfirmImport()}
                  disabled={!validRows.length || importing}
                >
                  <Text style={styles.btnPrimaryText}>
                    {t("actionImport")}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    maxHeight: "88%",
    overflow: "hidden",
  },
  header: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    ...rtlText,
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  hint: {
    ...rtlText,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  option: {
    ...rtlRow(),
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    ...rtlText,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  optionSub: {
    ...rtlText,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  actions: {
    ...rtlRow(),
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
  },
  btnGhost: {
    backgroundColor: "transparent",
  },
  btnGhostText: {
    ...rtlText,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    ...rtlText,
    fontFamily: fonts.semiBold,
    color: "#fff",
  },
  loadingRow: {
    ...rtlRow(),
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  loadingText: {
    ...rtlText,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  stats: {
    ...rtlText,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  sectionLabel: {
    ...rtlText,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  sectionHint: {
    ...rtlText,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -spacing.sm,
  },
  groupChips: {
    ...rtlRow(),
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft ?? colors.background,
  },
  chipText: {
    ...rtlText,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  previewList: {
    maxHeight: 220,
  },
  previewRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  previewName: {
    ...rtlText,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  previewError: {
    color: colors.danger,
  },
  previewMeta: {
    ...rtlText,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  moreRows: {
    ...rtlText,
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
});
