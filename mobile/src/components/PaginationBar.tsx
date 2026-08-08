import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { t } from "@/src/i18n/ar";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { rtlRow, rtlText } from "@/src/theme/rtl";
/** Shared shape from useClientPagination / useServerPagination. */
type PagingLike = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevPage: () => void;
  nextPage: () => void;
};

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Hide when a single page covers everything. */
  hideWhenSinglePage?: boolean;
};

/** Build PaginationBar props from a paging hook result. */
export function pagingBarProps(
  paging: PagingLike,
  hideWhenSinglePage = true
): Props {
  return {
    page: paging.page,
    totalPages: paging.totalPages,
    totalItems: paging.totalItems,
    pageSize: paging.pageSize,
    hasPrev: paging.hasPrev,
    hasNext: paging.hasNext,
    onPrev: paging.prevPage,
    onNext: paging.nextPage,
    hideWhenSinglePage,
  };
}

/** Prev / next bar shared by paginated FlatLists. */
export function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  hideWhenSinglePage = true,
}: Props) {
  if (hideWhenSinglePage && totalPages <= 1) return null;

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <View style={styles.wrap}>
      <Text style={styles.meta}>
        {t("paginationRange", { from, to, total: totalItems })}
      </Text>
      <View style={styles.row}>
        {/* RTL: "next" (older pages toward end) sits on the start visually */}
        <Pressable
          onPress={onNext}
          disabled={!hasNext}
          style={[styles.btn, !hasNext && styles.btnDisabled]}
          accessibilityLabel={t("paginationNext")}
        >
          <FontAwesome
            name="chevron-left"
            size={14}
            color={hasNext ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.btnText, !hasNext && styles.btnTextDisabled]}>
            {t("paginationNext")}
          </Text>
        </Pressable>

        <Text style={styles.pageLabel}>
          {t("paginationPageOf", { page, totalPages })}
        </Text>

        <Pressable
          onPress={onPrev}
          disabled={!hasPrev}
          style={[styles.btn, !hasPrev && styles.btnDisabled]}
          accessibilityLabel={t("paginationPrev")}
        >
          <Text style={[styles.btnText, !hasPrev && styles.btnTextDisabled]}>
            {t("paginationPrev")}
          </Text>
          <FontAwesome
            name="chevron-right"
            size={14}
            color={hasPrev ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 8,
  },
  meta: {
    ...rtlText,
    width: "100%",
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  row: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  pageLabel: {
    ...rtlText,
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 13,
  },
  btn: {
    ...rtlRow(),
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  btnDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  btnText: {
    ...rtlText,
    fontFamily: fonts.bold,
    color: colors.primary,
    fontSize: 13,
  },
  btnTextDisabled: {
    color: colors.textMuted,
  },
});
