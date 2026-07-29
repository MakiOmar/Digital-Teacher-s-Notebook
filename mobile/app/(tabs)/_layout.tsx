import { Tabs } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/src/theme/colors";
import { t } from "@/src/i18n/ar";

function TabIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "rgba(255,255,255,0.94)" },
        headerShadowVisible: false,
        headerTitleAlign: "center",
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.97)",
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: "transparent" },
        tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          tabBarIcon: ({ color }) => (
            <TabIcon name="home" color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: t("todaySchedule"),
          tabBarIcon: ({ color }) => (
            <TabIcon name="clock-o" color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: t("groups"),
          tabBarIcon: ({ color }) => (
            <TabIcon name="users" color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: t("payments"),
          tabBarIcon: ({ color }) => (
            <TabIcon name="money" color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("more"),
          tabBarIcon: ({ color }) => (
            <TabIcon name="bars" color={String(color)} />
          ),
        }}
      />
      {/* Hidden from tab bar — reachable via Home / More */}
      <Tabs.Screen
        name="students"
        options={{
          href: null,
          title: t("students"),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          href: null,
          title: t("weeklySchedule"),
        }}
      />
    </Tabs>
  );
}
