import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { radii, spacing } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { fonts } from "@/src/theme/typography";
import { rtlBlock, rtlRow, rtlText } from "@/src/theme/rtl";
import { t } from "@/src/i18n/ar";

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterField = {
  key: string;
  label: string;
  /** Currently applied value. */
  value: string;
  options: FilterOption[];
};

/**
 * Filter trigger → modal with option lists → تطبيق / إلغاء.
 * Draft values only commit when the user taps Apply.
 */
export function FiltersSheet({
  fields,
  onApply,
  triggerLabel,
  title,
  icon = "filter",
  showBadge = true,
}: {
  fields: FilterField[];
  onApply: (values: Record<string, string>) => void;
  /** Button label; defaults to تصفية. */
  triggerLabel?: string;
  /** Modal title; defaults to triggerLabel or تصفية. */
  title?: string;
  icon?: React.ComponentProps<typeof FontAwesome>["name"];
  /** Hide the numeric badge (useful for single required selects like month). */
  showBadge?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const buttonLabel = triggerLabel ?? t("filter");
  const sheetTitle = title ?? buttonLabel;

  const appliedSummary = useMemo(() => {
    return fields
      .map((f) => {
        const opt = f.options.find((o) => o.value === f.value);
        return opt?.label ?? f.value;
      })
      .filter(Boolean)
      .join(" · ");
  }, [fields]);

  const activeCount = useMemo(() => {
    return fields.filter((f) => f.value !== "all" && f.value !== "").length;
  }, [fields]);

  const openSheet = () => {
    // Snapshot applied values into the draft once when opening.
    const next: Record<string, string> = {};
    for (const f of fields) next[f.key] = f.value;
    setDraft(next);
    setOpen(true);
  };

  const close = () => setOpen(false);

  const apply = () => {
    onApply(draft);
    setOpen(false);
  };

  return (
    <View style={[styles.triggerWrap, rtlBlock]}>
      {/* Comment: list toolbar — opens the filter sheet. */}
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        style={({ pressed }) => [
          styles.trigger,
          rtlRow(),
          {
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
          },
          pressed && { opacity: 0.75 },
        ]}
      >
        <FontAwesome name={icon} size={14} color={colors.primary} />
        <Text style={[styles.triggerText, { color: colors.primary }]}>
          {buttonLabel}
        </Text>
        {showBadge && activeCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{activeCount}</Text>
          </View>
        ) : null}
      </Pressable>
      {appliedSummary ? (
        <Text style={[styles.summary, { color: colors.textMuted }]} numberOfLines={2}>
          {appliedSummary}
        </Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.title, { color: colors.text }]}>{sheetTitle}</Text>
            <ScrollView
              style={styles.body}
              contentContainerStyle={{
                gap: spacing.lg,
                paddingBottom: spacing.sm,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {fields.map((field) => (
                <View key={field.key} style={rtlBlock}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>
                    {field.label}
                  </Text>
                  <View style={styles.options}>
                    {field.options.map((opt) => {
                      const on =
                        (draft[field.key] ?? field.value) === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() =>
                            setDraft((prev) => ({
                              ...prev,
                              [field.key]: opt.value,
                            }))
                          }
                          style={({ pressed }) => [
                            styles.option,
                            {
                              borderColor: on ? colors.primary : colors.border,
                              backgroundColor: on
                                ? colors.primarySoft
                                : colors.backgroundAlt,
                            },
                            pressed && { opacity: 0.75 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              { color: on ? colors.primary : colors.text },
                            ]}
                            numberOfLines={2}
                          >
                            {opt.label}
                          </Text>
                          {on ? (
                            <FontAwesome
                              name="check"
                              size={14}
                              color={colors.primary}
                            />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Comment: commit draft filters vs dismiss without changes. */}
            <View style={[styles.actions, rtlRow()]}>
              <Pressable
                onPress={close}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  { borderColor: colors.border },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                  {t("cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={apply}
                style={({ pressed }) => [
                  styles.applyBtn,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.applyText}>{t("applyFilter")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Single-value select styled like FormField — tap opens an options modal. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  searchable = false,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show a search box when the list can get long (e.g. groups). */
  searchable?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder ?? t("selectYear");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={[styles.fieldWrap, rtlBlock]}>
      <Text style={[styles.fieldLabelOutside, { color: colors.text }]}>
        {label}
      </Text>
      <Pressable
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.selectTrigger,
          rtlRow(),
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={[styles.selectValue, { color: colors.text }]} numberOfLines={1}>
          {display}
        </Text>
        <FontAwesome name="chevron-down" size={14} color={colors.primary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
          />
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.title, { color: colors.text }]}>{label}</Text>
            {searchable ? (
              <View
                style={[
                  styles.searchShell,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <FontAwesome name="search" size={14} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t("searchPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.searchInput, { color: colors.text }]}
                  autoCorrect={false}
                />
              </View>
            ) : null}
            <ScrollView
              style={styles.body}
              contentContainerStyle={{
                gap: spacing.sm,
                paddingBottom: spacing.sm,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {filtered.length === 0 ? (
                <Text style={[styles.emptySearch, { color: colors.textMuted }]}>
                  {t("empty")}
                </Text>
              ) : (
                filtered.map((opt) => {
                  const on = opt.value === value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        onChange(opt.value);
                        close();
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        {
                          borderColor: on ? colors.primary : colors.border,
                          backgroundColor: on
                            ? colors.primarySoft
                            : colors.backgroundAlt,
                        },
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          { color: on ? colors.primary : colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {opt.label}
                      </Text>
                      {on ? (
                        <FontAwesome
                          name="check"
                          size={14}
                          color={colors.primary}
                        />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable
              onPress={close}
              style={({ pressed }) => [
                styles.cancelBtn,
                { borderColor: colors.border },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                {t("cancel")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  triggerWrap: {
    width: "100%",
    marginBottom: spacing.sm,
  },
  trigger: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  triggerText: {
    ...rtlText,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  summary: {
    ...rtlText,
    marginTop: 6,
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    maxHeight: "82%",
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    ...rtlText,
    width: "100%",
    fontSize: 18,
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  body: {
    maxHeight: 420,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...rtlText,
    width: "100%",
    marginBottom: spacing.sm,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  fieldWrap: {
    width: "100%",
    marginBottom: spacing.md,
  },
  fieldLabelOutside: {
    ...rtlText,
    width: "100%",
    marginBottom: 6,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  selectTrigger: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  searchShell: {
    ...rtlRow(),
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  emptySearch: {
    ...rtlText,
    fontFamily: fonts.regular,
    paddingVertical: spacing.md,
  },
  selectValue: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  optionText: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
    alignItems: "stretch",
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    ...rtlText,
    fontFamily: fonts.bold,
  },
  applyBtn: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  applyText: {
    ...rtlText,
    fontFamily: fonts.bold,
    color: "#fff",
    fontSize: 15,
  },
});
