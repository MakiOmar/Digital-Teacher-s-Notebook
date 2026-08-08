import { Platform, Text } from "react-native";
import { Tabs } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { t } from "@/src/i18n/ar";

/** Default tab content height (icons + labels), excluding system inset. */
const TAB_BAR_CONTENT_HEIGHT = 56;

function TabIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} {...props} />;
}

function TabLabel({
  color,
  children,
}: {
  color: string;
  children: string;
}) {
  return (
    <Text
      style={{
        color,
        fontSize: 11,
        fontFamily: fonts.bold,
        // Android: custom fontFamily + bold weight → Roboto fallback
        fontWeight: Platform.OS === "android" ? "normal" : "700",
        textAlign: "center",
      }}
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Transparent system nav (edge-to-edge) draws under the tab bar —
  // pad so labels clear the native back/home/recents controls.
  const bottomInset =
    Platform.OS === "android"
      ? Math.max(insets.bottom, 16)
      : insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // Apply inset ourselves so height + padding stay in sync.
        safeAreaInsets: { bottom: 0 },
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.97)",
          borderTopColor: colors.border,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 4,
        },
        sceneStyle: { backgroundColor: "transparent" },
        tabBarLabel: ({ color, children }) => (
          <TabLabel color={String(color)}>{String(children)}</TabLabel>
        ),
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
