import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { radii, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { rtlText } from "../theme/rtl";
import { t } from "../i18n/ar";

export type DialogPickOption = {
  id: string;
  label: string;
  destructive?: boolean;
};

type ConfirmRequest = {
  kind: "confirm";
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

type AlertRequest = {
  kind: "alert";
  title: string;
  message?: string;
  buttonLabel?: string;
  resolve: () => void;
};

type PickRequest = {
  kind: "pick";
  title: string;
  message?: string;
  options: DialogPickOption[];
  resolve: (id: string | null) => void;
};

type DialogRequest = ConfirmRequest | AlertRequest | PickRequest;

type ToastItem = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};

type DialogApi = {
  confirm: (opts: {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  alert: (opts: {
    title: string;
    message?: string;
    buttonLabel?: string;
  }) => Promise<void>;
  pick: (opts: {
    title: string;
    message?: string;
    options: DialogPickOption[];
  }) => Promise<string | null>;
  toast: (
    message: string,
    type?: "success" | "error" | "info"
  ) => void;
};

const DialogContext = createContext<DialogApi | null>(null);

/** App-wide modern dialogs / toasts — never use React Native Alert. */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const dismissConfirm = useCallback((ok: boolean) => {
    setRequest((cur) => {
      if (cur?.kind === "confirm") cur.resolve(ok);
      return null;
    });
  }, []);

  const dismissAlert = useCallback(() => {
    setRequest((cur) => {
      if (cur?.kind === "alert") cur.resolve();
      return null;
    });
  }, []);

  const dismissPick = useCallback((id: string | null) => {
    setRequest((cur) => {
      if (cur?.kind === "pick") cur.resolve(id);
      return null;
    });
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (opts) =>
        new Promise<boolean>((resolve) => {
          setRequest({ kind: "confirm", ...opts, resolve });
        }),
      alert: (opts) =>
        new Promise<void>((resolve) => {
          setRequest({ kind: "alert", ...opts, resolve });
        }),
      pick: (opts) =>
        new Promise<string | null>((resolve) => {
          setRequest({ kind: "pick", ...opts, resolve });
        }),
      toast: (message, type = "info") => {
        const id = ++toastId.current;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== id));
        }, 2800);
      },
    }),
    []
  );

  return (
    <DialogContext.Provider value={api}>
      {children}

      <Modal
        visible={request != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!request) return;
          if (request.kind === "confirm") dismissConfirm(false);
          else if (request.kind === "alert") dismissAlert();
          else dismissPick(null);
        }}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!request) return;
              if (request.kind === "confirm") dismissConfirm(false);
              else if (request.kind === "alert") dismissAlert();
              else dismissPick(null);
            }}
          />
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {request ? (
              <>
                <Text style={[styles.title, { color: colors.text }]}>
                  {request.title}
                </Text>
                {request.message ? (
                  <Text style={[styles.message, { color: colors.textMuted }]}>
                    {request.message}
                  </Text>
                ) : null}

                {request.kind === "pick" ? (
                  <ScrollView
                    style={styles.pickList}
                    contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                  >
                    {request.options.map((opt) => (
                      <Pressable
                        key={opt.id}
                        onPress={() => dismissPick(opt.id)}
                        style={({ pressed }) => [
                          styles.pickRow,
                          {
                            borderColor: opt.destructive
                              ? colors.unpaidBorder
                              : colors.border,
                            backgroundColor: opt.destructive
                              ? colors.unpaid
                              : colors.backgroundAlt,
                          },
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pickLabel,
                            {
                              color: opt.destructive
                                ? colors.danger
                                : colors.text,
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}

                <View style={styles.actions}>
                  {request.kind === "confirm" ? (
                    <>
                      <Pressable
                        onPress={() => dismissConfirm(false)}
                        style={({ pressed }) => [
                          styles.btn,
                          {
                            backgroundColor: colors.backgroundAlt,
                            borderWidth: 1,
                            borderColor: colors.border,
                          },
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <Text style={[styles.btnGhostText, { color: colors.text }]}>
                          {request.cancelLabel ?? t("cancel")}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => dismissConfirm(true)}
                        style={({ pressed }) => [
                          styles.btn,
                          {
                            backgroundColor: request.danger
                              ? colors.danger
                              : colors.primary,
                          },
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <Text style={styles.btnPrimaryText}>
                          {request.confirmLabel ?? t("confirm")}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}

                  {request.kind === "alert" ? (
                    <Pressable
                      onPress={dismissAlert}
                      style={({ pressed }) => [
                        styles.btn,
                        { backgroundColor: colors.primary },
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <Text style={styles.btnPrimaryText}>
                        {request.buttonLabel ?? t("confirm")}
                      </Text>
                    </Pressable>
                  ) : null}

                  {request.kind === "pick" ? (
                    <Pressable
                      onPress={() => dismissPick(null)}
                      style={({ pressed }) => [
                        styles.btn,
                        {
                          backgroundColor: colors.backgroundAlt,
                          borderWidth: 1,
                          borderColor: colors.border,
                        },
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <Text style={[styles.btnGhostText, { color: colors.text }]}>
                        {t("cancel")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <View pointerEvents="box-none" style={styles.toastHost}>
        {toasts.map((toast) => (
          <View
            key={toast.id}
            style={[
              styles.toast,
              toast.type === "success"
                ? { backgroundColor: colors.success }
                : toast.type === "error"
                  ? { backgroundColor: colors.danger }
                  : { backgroundColor: colors.surface },
            ]}
          >
            <Text
              style={[
                styles.toastText,
                toast.type === "info" ? { color: colors.text } : null,
              ]}
            >
              {toast.message}
            </Text>
          </View>
        ))}
      </View>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used within DialogProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    maxHeight: "78%",
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    ...rtlText,
    width: "100%",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  message: {
    ...rtlText,
    width: "100%",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  pickList: {
    maxHeight: 320,
    marginBottom: spacing.md,
  },
  pickRow: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  pickLabel: {
    ...rtlText,
    width: "100%",
    fontSize: 15,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row-reverse",
    gap: 10,
    justifyContent: "flex-start",
    flexWrap: "wrap",
  },
  btn: {
    minWidth: 96,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    alignItems: "center",
  },
  btnPrimaryText: {
    ...rtlText,
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  btnGhostText: {
    ...rtlText,
    fontWeight: "700",
    fontSize: 14,
  },
  toastHost: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 36,
    gap: 8,
    zIndex: 100,
  },
  toast: {
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  toastText: {
    ...rtlText,
    width: "100%",
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
