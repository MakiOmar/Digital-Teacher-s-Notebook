import { useCallback, useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  EmptyState,
  ListRow,
  LoadingBlock,
  PrimaryButton,
  Screen,
} from "@/src/components/ui";
import { t } from "@/src/i18n/ar";
import {
  deleteAcademicYear,
  listAcademicYears,
  setActiveYear,
} from "@/src/repositories";
import type { AcademicYear } from "@/src/db/types";
import { useAppData } from "@/src/contexts/AppDataContext";
import { spacing } from "@/src/theme/colors";

export default function YearsScreen() {
  const router = useRouter();
  const { bump } = useAppData();
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState<AcademicYear[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setYears(await listAcademicYears());
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
      <View style={{ padding: spacing.lg }}>
        <PrimaryButton
          label={t("addYear")}
          onPress={() => router.push("/years/form")}
        />
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40 }}
        data={years}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<EmptyState message={t("empty")} />}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${item.start_date} → ${item.end_date}`}
            right={item.is_active ? t("activeYear") : undefined}
            onPress={() => {
              Alert.alert(item.name, undefined, [
                {
                  text: t("activateYear"),
                  onPress: () => {
                    void setActiveYear(item.id).then(() => {
                      bump();
                      void load();
                    });
                  },
                },
                {
                  text: t("delete"),
                  style: "destructive",
                  onPress: () => {
                    Alert.alert(t("delete"), t("deleteConfirm"), [
                      { text: t("cancel"), style: "cancel" },
                      {
                        text: t("delete"),
                        style: "destructive",
                        onPress: () => {
                          void deleteAcademicYear(item.id).then(() => {
                            bump();
                            void load();
                          });
                        },
                      },
                    ]);
                  },
                },
                { text: t("cancel"), style: "cancel" },
              ]);
            }}
          />
        )}
      />
    </Screen>
  );
}
