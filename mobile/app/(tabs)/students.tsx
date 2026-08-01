import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  EmptyState,
  ListRow,
  LoadingBlock,
  Screen,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { t } from "@/src/i18n/ar";
import { getActiveEnrollment, listStudents } from "@/src/repositories";
import type { Student } from "@/src/db/types";
import { spacing, colors } from "@/src/theme/colors";

export default function StudentsTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    (Student & { groupName: string })[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const students = await listStudents();
      const enriched = await Promise.all(
        students.map(async (s) => {
          const en = await getActiveEnrollment(s.id);
          return { ...s, groupName: en?.group_name ?? "—" };
        })
      );
      setRows(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <IconActionBar
          actions={[
            {
              key: "add",
              icon: "plus",
              label: t("actionAdd"),
              tone: "accent",
              onPress: () => router.push("/students/form"),
            },
          ]}
        />
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40 }}
        data={rows}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<EmptyState message={t("noStudents")} />}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${item.groupName}${item.guardian_phone ? ` · ${item.guardian_phone}` : ""}`}
            right={item.status === "active" ? t("active") : item.status}
            borderColor={colors.primary}
            onPress={() => router.push(`/students/${item.id}`)}
          />
        )}
        refreshing={loading}
        onRefresh={() => void load()}
      />
    </Screen>
  );
}
