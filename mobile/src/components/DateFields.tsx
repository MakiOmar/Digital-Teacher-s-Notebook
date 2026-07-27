import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { colors, spacing } from "../theme/colors";
import { rtlBlock, rtlRow, rtlText } from "../theme/rtl";
import {
  dateToTimeHm,
  formatDateAr,
  parseDateOnly,
  timeHmToDate,
  toDateOnly,
} from "../utils/date";

const PICK = "اختيار";

function PickerBox({
  valueLabel,
  onPress,
}: {
  valueLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.box, pressed && { opacity: 0.75 }]}
    >
      {/* Cluster value + hint on the visual right (rtlRow starts from the right). */}
      <View style={[styles.boxInner, rtlRow()]}>
        <Text style={styles.value}>{valueLabel}</Text>
        <Text style={styles.hint}>{PICK}</Text>
      </View>
    </Pressable>
  );
}

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  minimumDate?: string;
  maximumDate?: string;
};

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  function onPick(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
    }
    if (event.type === "dismissed") return;
    if (selected) onChange(toDateOnly(selected));
  }

  return (
    <View style={[styles.field, rtlBlock]}>
      <Text style={styles.label}>{label}</Text>
      <PickerBox
        valueLabel={formatDateAr(value)}
        onPress={() => setOpen(true)}
      />
      {open ? (
        <DateTimePicker
          value={parseDateOnly(value)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPick}
          minimumDate={minimumDate ? parseDateOnly(minimumDate) : undefined}
          maximumDate={maximumDate ? parseDateOnly(maximumDate) : undefined}
        />
      ) : null}
      {Platform.OS === "ios" && open ? (
        <Pressable onPress={() => setOpen(false)} style={styles.iosDone}>
          <Text style={styles.iosDoneText}>تم</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type TimeFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
};

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const [open, setOpen] = useState(false);

  function onPick(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
    }
    if (event.type === "dismissed") return;
    if (selected) onChange(dateToTimeHm(selected));
  }

  return (
    <View style={[styles.field, rtlBlock]}>
      <Text style={styles.label}>{label}</Text>
      <PickerBox valueLabel={value} onPress={() => setOpen(true)} />
      {open ? (
        <DateTimePicker
          value={timeHmToDate(value)}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPick}
        />
      ) : null}
      {Platform.OS === "ios" && open ? (
        <Pressable onPress={() => setOpen(false)} style={styles.iosDone}>
          <Text style={styles.iosDoneText}>تم</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: {
    ...rtlText,
    width: "100%",
    marginBottom: 6,
    color: colors.text,
    fontWeight: "600",
  },
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  boxInner: {
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
  value: {
    color: colors.text,
    fontSize: 16,
    ...rtlText,
  },
  hint: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "700",
    ...rtlText,
  },
  iosDone: {
    alignSelf: "flex-end",
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  iosDoneText: {
    color: colors.primary,
    fontWeight: "700",
    ...rtlText,
  },
});
