import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  EmptyState,
  LoadingBlock,
  Screen,
} from "@/src/components/ui";
import {
  getSessionAttendanceCoverage,
  listSessionsForGroup,
} from "@/src/repositories";
import type { GroupSession } from "@/src/db/types";
import { SessionClassButton } from "@/src/components/SessionClassButton";
import { t } from "@/src/i18n/ar";
import { spacing } from "@/src/theme/colors";

export default function GroupSessionsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const id = Number(groupId);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [coverage, setCoverage] = useState<
    Record<number, { marked: number; total: number }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(await listSessionsForGroup(id));
      setCoverage(await getSessionAttendanceCoverage(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<EmptyState message={t("noSessions")} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        renderItem={({ item }) => (
          <SessionClassButton
            session={item}
            coverage={coverage[item.id]}
            onPress={() => router.push(`/attendance/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}
