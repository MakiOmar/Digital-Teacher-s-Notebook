import { Image, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme/colors";
import { rtlRow, rtlText } from "../theme/rtl";
import { t } from "../i18n/ar";

const STAR_ICON = require("../../assets/images/star.png");

/** Month/round title with star badge — display only (who is the month star). */
export function MonthStarTitle({
  title,
  starName,
}: {
  title: string;
  starName?: string | null;
}) {
  return (
    <View style={styles.wrap}>
      {/* Round / month heading */}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.starRow}>
        <Image source={STAR_ICON} style={styles.starIcon} />
        <Text style={styles.starText} numberOfLines={1}>
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
  title: {
    ...rtlText,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  starRow: {
    ...rtlRow(),
    alignItems: "center",
    gap: 6,
    maxWidth: "48%",
    backgroundColor: "#FFFBEB",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.star,
    paddingVertical: 4,
    paddingHorizontal: 10,
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
    color: colors.text,
    flexShrink: 1,
  },
});
