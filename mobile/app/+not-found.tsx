import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/theme/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "غير موجود" }} />
      <View style={styles.container}>
        <Text style={styles.title}>الصفحة غير موجودة</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>العودة للرئيسية</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  link: { marginTop: 16, paddingVertical: 12 },
  linkText: { color: colors.primary, fontWeight: "600" },
});
