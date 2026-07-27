import { useRouter } from "expo-router";
import { StyleSheet, Text, Pressable, View } from "react-native";
import { Screen, Title } from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import { colors, spacing } from "@/src/theme/colors";
import { rtlText } from "@/src/theme/rtl";
import { useAppData } from "@/src/contexts/AppDataContext";

function MoreItem({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.item}>
      <Text style={styles.itemText}>{label}</Text>
    </Pressable>
  );
}

export default function MoreTab() {
  const router = useRouter();
  const { activeYear } = useAppData();

  return (
    <Screen>
      <Title>{t("more")}</Title>
      {activeYear ? (
        <Text style={styles.meta}>
          {t("activeYear")}: {activeYear.name}
        </Text>
      ) : null}
      <View style={{ marginTop: spacing.md }}>
        <MoreItem
          label={t("academicYears")}
          onPress={() => router.push("/years")}
        />
        <MoreItem label={t("backup")} onPress={() => router.push("/backup")} />
        <MoreItem label={t("about")} onPress={() => router.push("/about")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    ...rtlText,
    width: "100%",
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  item: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemText: {
    ...rtlText,
    width: "100%",
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
});
