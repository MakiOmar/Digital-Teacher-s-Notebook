import { useCallback, useMemo, useState } from "react";
import { FlatList, Linking, Pressable, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFocusEffect, useRouter } from "expo-router";
import {
  EmptyState,
  ListRow,
  Screen,
  SearchField,
  SkeletonList,
} from "@/src/components/ui";
import { IconActionBar } from "@/src/components/IconActionBar";
import { t } from "@/src/i18n/ar";
import { getActiveEnrollment, listStudents } from "@/src/repositories";
import type { Student } from "@/src/db/types";
import { spacing, colors } from "@/src/theme/colors";

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export default function StudentsTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<(Student & { groupName: string })[]>([]);

  const load = useCallback(async () => {
    const hadRows = rows.length > 0;
    if (!hadRows) setLoading(true);
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
  }, [rows.length]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return rows;
    return rows.filter((r) => r.name.includes(q));
  }, [rows, query]);

  if (loading && !rows.length) {
    return (
      <Screen padded={false} style={{ flex: 1 }}>
        <SkeletonList />
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
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchPlaceholder")}
        />
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
        }}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <EmptyState
            message={t("noStudents")}
            actionLabel={t("addStudentCta")}
            onAction={() => router.push("/students/form")}
          />
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${item.groupName}${item.guardian_phone ? ` · ${item.guardian_phone}` : ""}`}
            right={item.status === "active" ? t("active") : item.status}
            borderColor={colors.primary}
            onPress={() => router.push(`/students/${item.id}`)}
            trailing={
              item.guardian_phone ? (
                  <Pressable
                  onPress={() => {
                    void Linking.openURL(`tel:${digitsOnly(item.guardian_phone!)}`);
                  }}
                  hitSlop={10}
                  accessibilityLabel={t("callGuardian")}
                  style={{ padding: 6 }}
                >
                  <FontAwesome name="phone" size={18} color={colors.success} />
                </Pressable>
              ) : null
            }
          />
        )}
        refreshing={loading}
        onRefresh={() => void load()}
      />
    </Screen>
  );
}
