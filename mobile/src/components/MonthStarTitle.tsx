import { Image, StyleSheet, Text, View } from "react-native";
import { spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { rtlRow, rtlText } from "../theme/rtl";
import { t } from "../i18n/ar";

const STAR_ICON = require("../../assets/images/star.png");

/** Month-star badge; optional title when the round label is shown elsewhere. */
export function MonthStarTitle({
  title,
  starName,
}: {
  title?: string | null;
  starName?: string | null;
}) {
  const colors = useColors();
  const showTitle = Boolean(title?.trim());

  return (
    <View style={[styles.wrap, !showTitle && styles.wrapStarOnly]}>
      {showTitle ? (
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      ) : null}
      <View
        style={[
          styles.starRow,
          !showTitle && styles.starRowFull,
          {
            backgroundColor: colors.partial,
            borderColor: colors.star,
          },
        ]}
      >
        <Image source={STAR_ICON} style={styles.starIcon} />
        <Text
          style={[styles.starText, { color: colors.text }]}
          numberOfLines={1}
        >
          {starName ? starName : t("monthStarNone")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...rtlRow(),
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    width: "100%",
    marginVertical: spacing.xs,
  },
  wrapStarOnly: {
    justifyContent: "flex-start",
  },
  title: {
    ...rtlText,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  starRow: {
    ...rtlRow(),
    alignItems: "center",
    gap: 6,
    maxWidth: "48%",
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  starRowFull: {
    maxWidth: "100%",
  },
  starIcon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
  },
  starText: {
    ...rtlText,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
});
