import { useEffect, useState } from "react";
import { Keyboard, type KeyboardEvent, Platform } from "react-native";

/**
 * Bottom inset matching the software keyboard height.
 * Works even when the activity does not resize (common Android default).
 */
export function useKeyboardBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      setInset(Math.max(0, e.endCoordinates?.height ?? 0));
    };
    const onHide = () => setInset(0);

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return inset;
}
