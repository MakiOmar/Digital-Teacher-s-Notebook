import { I18nManager, Platform, Text } from "react-native";
import { Tabs } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/src/theme/typography";
import { useColors } from "@/src/theme/ThemeContext";
import { t } from "@/src/i18n/ar";
import { useLanguage } from "@/src/i18n/LanguageContext";

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

type TabName = "index" | "today" | "groups" | "payments" | "more";

/** Logical LTR declaration order (Home … More). */
const LTR_TABS: TabName[] = ["index", "today", "groups", "payments", "more"];
/** Compensates when preferred language RTL and native Yoga RTL disagree. */
const REVERSED_TABS: TabName[] = ["more", "payments", "groups", "today", "index"];

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const colors = useColors();
  // Under forceRTL, the tab bar packs from the reading-start edge (right in Arabic).
  // First Screen lands on that edge — so declare LTR_TABS when native RTL matches.
  // If language and I18nManager.isRTL lag apart, reverse to keep Home on the start edge.
  const wantRtl = language === "ar";
  const order = wantRtl === I18nManager.isRTL ? LTR_TABS : REVERSED_TABS;
  // Transparent system nav (edge-to-edge) draws under the tab bar —
  // pad so labels clear the native back/home/recents controls.
  const bottomInset =
    Platform.OS === "android"
      ? Math.max(insets.bottom, 16)
      : insets.bottom;

  const tabOptions: Record<
    TabName,
    {
      title: string;
      icon: React.ComponentProps<typeof FontAwesome>["name"];
    }
  > = {
    index: { title: t("home"), icon: "home" },
    today: { title: t("todaySchedule"), icon: "clock-o" },
    groups: { title: t("groups"), icon: "users" },
    payments: { title: t("payments"), icon: "money" },
    more: { title: t("more"), icon: "bars" },
  };

  return (
    <Tabs
      key={language}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 4,
        },
        // Opaque scenes — transparent tab scenes show both tabs' text mid-switch.
        sceneStyle: { backgroundColor: colors.background },
        tabBarLabel: ({ color, children }) => (
          <TabLabel color={String(color)}>{String(children)}</TabLabel>
        ),
      }}
    >
      {order.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: tabOptions[name].title,
            tabBarIcon: ({ color }) => (
              <TabIcon name={tabOptions[name].icon} color={String(color)} />
            ),
          }}
        />
      ))}
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
