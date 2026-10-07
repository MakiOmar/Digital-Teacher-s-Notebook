import { useLayoutEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "expo-router";
import {
  OverflowMenuButton,
  type IconAction,
} from "@/src/components/IconActionBar";
import {
  FiltersSheet,
  type FilterField,
} from "@/src/components/FilterSelect";
import type FontAwesome from "@expo/vector-icons/FontAwesome";
import type { ComponentProps } from "react";

export type HeaderFilterConfig = {
  fields: FilterField[];
  onApply: (values: Record<string, string>) => void;
  title?: string;
  icon?: ComponentProps<typeof FontAwesome>["name"];
  showBadge?: boolean;
};

/**
 * Puts filter + ⋮ menu in the stack headerRight (same row as the page title).
 */
export function useHeaderToolbar(opts: {
  actions?: IconAction[];
  filter?: HeaderFilterConfig | null;
}) {
  const navigation = useNavigation();
  const actions = opts.actions ?? [];
  const filter = opts.filter ?? null;

  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const actionKeys = actions
    .map((a) => `${a.key}:${a.disabled ? 1 : 0}:${a.label}`)
    .join("|");
  const filterKey = filter
    ? filter.fields
        .map(
          (f) =>
            `${f.key}=${f.value}:${f.label}:${f.options
              .map((o) => `${o.value}/${o.label}`)
              .join(",")}`
        )
        .join("|")
    : "";

  useLayoutEffect(() => {
    const hasActions = actionsRef.current.length > 0;
    const hasFilter = !!filterRef.current;
    if (!hasActions && !hasFilter) {
      navigation.setOptions({ headerRight: undefined });
      return;
    }

    // headerRight is only rebuilt when actionKeys change, so route presses
    // through the ref or onPress would see stale form state.
    const liveActions: IconAction[] = actionsRef.current.map((action) => ({
      ...action,
      onPress: () =>
        actionsRef.current.find((a) => a.key === action.key)?.onPress(),
    }));

    navigation.setOptions({
      headerRight: () => (
        <View style={styles.cluster}>
          {filterRef.current ? (
            <FiltersSheet
              fields={filterRef.current.fields}
              onApply={(values) => filterRef.current?.onApply(values)}
              title={filterRef.current.title}
              icon={filterRef.current.icon}
              showBadge={filterRef.current.showBadge}
              variant="icon"
              showSummary={false}
            />
          ) : null}
          {liveActions.length ? (
            <OverflowMenuButton actions={liveActions} />
          ) : null}
        </View>
      ),
    });

    return () => {
      navigation.setOptions({ headerRight: undefined });
    };
  }, [navigation, actionKeys, filterKey]);
}

const styles = StyleSheet.create({
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: 6,
  },
});
