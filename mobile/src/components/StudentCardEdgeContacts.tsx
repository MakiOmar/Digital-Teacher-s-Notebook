import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors, radii, spacing } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { appIsRtl, rtlText } from "@/src/theme/rtl";
import { telUrl, whatsappUrl } from "@/src/utils/phone";
import { t } from "@/src/i18n/ar";

const WHATSAPP_GREEN = "#25D366";
const SIZE = 32;
/** Keep icons clear of the screen edge (no negative side overhang). */
const EDGE_INSET = spacing.sm;

type Props = {
  studentPhone?: string | null;
  guardianPhone?: string | null;
};

type ContactGroup = {
  key: "student" | "guardian";
  title: string;
  phone: string;
  callLabel: string;
  waLabel: string;
  callColor: string;
};

/**
 * Call + WhatsApp for student and parent, straddling the top card edge
 * vertically (half in / half out). Kept inset from the screen side; RTL-aware.
 * Each person is a labeled pair so student vs guardian stay distinct.
 */
export function StudentCardEdgeContacts({
  studentPhone,
  guardianPhone,
}: Props) {
  const rtl = appIsRtl();
  const student = studentPhone?.trim() || null;
  const guardian = guardianPhone?.trim() || null;
  if (!student && !guardian) return null;

  const groups: ContactGroup[] = [];
  if (student) {
    groups.push({
      key: "student",
      title: t("contactStudentShort"),
      phone: student,
      callLabel: t("callStudent"),
      waLabel: t("whatsappStudent"),
      callColor: colors.success,
    });
  }
  if (guardian) {
    groups.push({
      key: "guardian",
      title: t("contactGuardianShort"),
      phone: guardian,
      callLabel: t("callGuardian"),
      waLabel: t("whatsappGuardian"),
      callColor: colors.accent,
    });
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.rail, rtl ? styles.railRtl : styles.railLtr]}
    >
      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <View style={styles.pair}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={group.callLabel}
              hitSlop={6}
              onPress={(e) => {
                e?.stopPropagation?.();
                void Linking.openURL(telUrl(group.phone));
              }}
              style={({ pressed }) => [
                styles.fab,
                { backgroundColor: group.callColor },
                pressed && { opacity: 0.85 },
              ]}
            >
              <FontAwesome name="phone" size={13} color="#fff" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={group.waLabel}
              hitSlop={6}
              onPress={(e) => {
                e?.stopPropagation?.();
                void Linking.openURL(whatsappUrl(group.phone));
              }}
              style={({ pressed }) => [
                styles.fab,
                { backgroundColor: WHATSAPP_GREEN },
                pressed && { opacity: 0.85 },
              ]}
            >
              <FontAwesome name="whatsapp" size={15} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.groupLabel} numberOfLines={1}>
            {group.title}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: "absolute",
    top: -(SIZE / 2),
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    zIndex: 4,
  },
  railLtr: {
    right: EDGE_INSET,
  },
  railRtl: {
    left: EDGE_INSET,
  },
  group: {
    alignItems: "center",
    gap: 2,
  },
  pair: {
    flexDirection: "row",
    gap: 5,
  },
  groupLabel: {
    ...rtlText,
    fontSize: 9,
    lineHeight: 11,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
    overflow: "hidden",
    maxWidth: SIZE * 2 + 8,
    textAlign: "center",
  },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 3,
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
