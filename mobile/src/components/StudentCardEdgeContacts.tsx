import { Linking, Pressable, StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/src/theme/colors";
import { appIsRtl } from "@/src/theme/rtl";
import { telUrl, whatsappUrl } from "@/src/utils/phone";
import { t } from "@/src/i18n/ar";

const WHATSAPP_GREEN = "#25D366";
const SIZE = 34;

type Props = {
  studentPhone?: string | null;
  guardianPhone?: string | null;
};

/**
 * Call + WhatsApp for student and parent, straddling the top card edge
 * (half in / half out) on the reading-end side (LTR right / RTL left).
 */
export function StudentCardEdgeContacts({
  studentPhone,
  guardianPhone,
}: Props) {
  const rtl = appIsRtl();
  const student = studentPhone?.trim() || null;
  const guardian = guardianPhone?.trim() || null;
  if (!student && !guardian) return null;

  const icons: {
    key: string;
    phone: string;
    kind: "call" | "wa";
    label: string;
    color: string;
  }[] = [];

  if (student) {
    icons.push(
      {
        key: "s-call",
        phone: student,
        kind: "call",
        label: t("callStudent"),
        color: colors.success,
      },
      {
        key: "s-wa",
        phone: student,
        kind: "wa",
        label: t("whatsappStudent"),
        color: WHATSAPP_GREEN,
      }
    );
  }
  if (guardian) {
    icons.push(
      {
        key: "g-call",
        phone: guardian,
        kind: "call",
        label: t("callGuardian"),
        color: colors.accent,
      },
      {
        key: "g-wa",
        phone: guardian,
        kind: "wa",
        label: t("whatsappGuardian"),
        color: WHATSAPP_GREEN,
      }
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.rail,
        rtl ? styles.railRtl : styles.railLtr,
      ]}
    >
      {icons.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          hitSlop={6}
          onPress={(e) => {
            // Prevent parent card Pressable from navigating away.
            e?.stopPropagation?.();
            void Linking.openURL(
              item.kind === "call"
                ? telUrl(item.phone)
                : whatsappUrl(item.phone)
            );
          }}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: item.color },
            pressed && { opacity: 0.85 },
          ]}
        >
          <FontAwesome
            name={item.kind === "call" ? "phone" : "whatsapp"}
            size={item.kind === "call" ? 14 : 16}
            color="#fff"
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: "absolute",
    top: -(SIZE / 2),
    flexDirection: "row",
    gap: 6,
    zIndex: 4,
  },
  railLtr: {
    right: -(SIZE / 2),
  },
  railRtl: {
    left: -(SIZE / 2),
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
