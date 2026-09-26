import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  OverflowMenuButton,
  type IconAction,
} from "@/src/components/IconActionBar";
import {
  FiltersSheet,
  filterAppliedSummary,
} from "@/src/components/FilterSelect";
import type { HeaderFilterConfig } from "@/src/components/useHeaderToolbar";
import { spacing } from "@/src/theme/colors";
import { useColors } from "@/src/theme/ThemeContext";
import { fonts } from "@/src/theme/typography";
import { rtlRow, rtlText } from "@/src/theme/rtl";

/**
 * Content toolbar for tabs / screens without a stack header title row:
 * optional title + filter icon + ⋮ on one row.
 */
export function PageToolbar({
  title,
  actions,
  filter,
  showFilterSummary = true,
  children,
}: {
  title?: ReactNode;
  actions?: IconAction[];
  filter?: HeaderFilterConfig | null;
  /** Applied filter labels under the row (tabs without nav chrome). */
  showFilterSummary?: boolean;
  children?: ReactNode;
}) {
  const colors = useColors();
  const hasActions = (actions?.length ?? 0) > 0;
  const hasFilter = !!filter;
  const hasTitle = title != null && title !== false;
  const summary =
    hasFilter && showFilterSummary
      ? filterAppliedSummary(filter.fields)
      : "";

  if (!hasTitle && !hasActions && !hasFilter && !children) return null;

  return (
    <View style={styles.wrap}>
      {hasTitle || hasActions || hasFilter ? (
        <View style={[styles.row, rtlRow()]}>
          {hasTitle ? <View style={styles.titleSlot}>{title}</View> : null}
          {hasFilter ? (
            <FiltersSheet
              fields={filter.fields}
              onApply={filter.onApply}
              title={filter.title}
              icon={filter.icon}
              showBadge={filter.showBadge}
              variant="icon"
              showSummary={false}
            />
          ) : null}
          {hasActions ? <OverflowMenuButton actions={actions!} /> : null}
        </View>
      ) : null}
      {summary ? (
        <Text
          style={[styles.summary, { color: colors.textMuted }]}
          numberOfLines={2}
        >
          {summary}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Convenience: build filter config without importing the type everywhere. */
export function pageFilter(
  fields: HeaderFilterConfig["fields"],
  onApply: HeaderFilterConfig["onApply"],
  extra?: Omit<HeaderFilterConfig, "fields" | "onApply">
): HeaderFilterConfig {
  return { fields, onApply, ...extra };
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  row: {
    alignItems: "center",
    gap: 8,
    minHeight: 40,
  },
  titleSlot: {
    flex: 1,
    minWidth: 0,
  },
  summary: {
    ...rtlText,
    marginTop: 4,
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
});
