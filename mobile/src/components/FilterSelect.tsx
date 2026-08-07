import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

type FilterSelectProps = {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Stretch to fill FilterBar cells (default true). */
  flex?: boolean;
};

/** Field + modal list — used for list filtering instead of chip rows. */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  flex = true,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? options[0],
    [options, value]
  );

  return (
    <View style={[styles.field, rtlBlock, flex ? { flex: 1, minWidth: 0 } : null]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.box, pressed && { opacity: 0.75 }]}
      >
        <View style={[styles.boxInner, rtlRow()]}>
          <Text style={styles.value} numberOfLines={1}>
            {selected?.label ?? value}
          </Text>
          <FontAwesome name="chevron-down" size={12} color={colors.primary} />
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View style={styles.card}>
            <Text style={styles.title}>{label}</Text>
            <ScrollView
              style={styles.list}
              contentContainerStyle={{ gap: spacing.sm }}
              keyboardShouldPersistTaps="handled"
            >
              {options.map((opt) => {
                const on = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
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
              })}
            </ScrollView>
            <Pressable
              onPress={() => setOpen(false)}
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

/** Horizontal wrap of filter fields above a list / search. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <View style={[styles.bar, rtlRow()]}>{children}</View>;
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.sm,
  },
  label: {
    ...rtlText,
    width: "100%",
    marginBottom: 6,
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontWeight: "600",
    fontSize: 13,
  },
  box: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  boxInner: {
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  value: {
    ...rtlText,
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  bar: {
    width: "100%",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
    maxHeight: "78%",
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
  list: {
    maxHeight: 320,
    marginBottom: spacing.md,
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
  cancelBtn: {
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
});
