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
import { colors, radii, spacing } from "@/src/theme/colors";
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
          pressed && { opacity: 0.75 },
        ]}
      >
        <FontAwesome name={icon} size={14} color={colors.primary} />
        <Text style={styles.triggerText}>{buttonLabel}</Text>
        {showBadge && activeCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeCount}</Text>
          </View>
        ) : null}
      </Pressable>
      {appliedSummary ? (
        <Text style={styles.summary} numberOfLines={2}>
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
          <View style={styles.card}>
            <Text style={styles.title}>{sheetTitle}</Text>
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
                  <Text style={styles.fieldLabel}>{field.label}</Text>
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
                            on && styles.optionOn,
                            pressed && { opacity: 0.75 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              on && styles.optionTextOn,
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
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={apply}
                style={({ pressed }) => [
                  styles.applyBtn,
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
      <Text style={styles.fieldLabelOutside}>{label}</Text>
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
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.selectValue} numberOfLines={1}>
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
          <View style={styles.card}>
            <Text style={styles.title}>{label}</Text>
            {searchable ? (
              <View style={styles.searchShell}>
                <FontAwesome name="search" size={14} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t("searchPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
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
                <Text style={styles.emptySearch}>{t("empty")}</Text>
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
                        on && styles.optionOn,
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <Text
                        style={[styles.optionText, on && styles.optionTextOn]}
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
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={styles.cancelText}>{t("cancel")}</Text>
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
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  triggerText: {
    ...rtlText,
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
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
    color: colors.textMuted,
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
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
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
    color: colors.text,
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
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  selectTrigger: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  searchShell: {
    ...rtlRow(),
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
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
    color: colors.text,
  },
  emptySearch: {
    ...rtlText,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    paddingVertical: spacing.md,
  },
  selectValue: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.text,
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
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  optionOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  optionTextOn: {
    color: colors.primary,
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
    alignItems: "stretch",
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    ...rtlText,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  applyBtn: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  applyText: {
    ...rtlText,
    fontFamily: fonts.bold,
    color: "#fff",
    fontSize: 15,
  },
});
