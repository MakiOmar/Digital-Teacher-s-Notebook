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
import { colors, radii, spacing } from "../theme/colors";
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
          <View style={styles.card}>
            {request ? (
              <>
                <Text style={styles.title}>{request.title}</Text>
                {request.message ? (
                  <Text style={styles.message}>{request.message}</Text>
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
                          opt.destructive && styles.pickRowDanger,
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pickLabel,
                            opt.destructive && styles.pickLabelDanger,
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
                          styles.btnGhost,
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <Text style={styles.btnGhostText}>
                          {request.cancelLabel ?? t("cancel")}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => dismissConfirm(true)}
                        style={({ pressed }) => [
                          styles.btn,
                          request.danger ? styles.btnDanger : styles.btnPrimary,
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
                        styles.btnPrimary,
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
                        styles.btnGhost,
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <Text style={styles.btnGhostText}>{t("cancel")}</Text>
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
              toast.type === "success" && styles.toastSuccess,
              toast.type === "error" && styles.toastError,
            ]}
          >
            <Text style={styles.toastText}>{toast.message}</Text>
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
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
    marginBottom: spacing.sm,
  },
  message: {
    ...rtlText,
    width: "100%",
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  pickList: {
    maxHeight: 320,
    marginBottom: spacing.md,
  },
  pickRow: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  pickRowDanger: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  pickLabel: {
    ...rtlText,
    width: "100%",
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  pickLabelDanger: {
    color: colors.danger,
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
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnDanger: {
    backgroundColor: colors.danger,
  },
  btnGhost: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnPrimaryText: {
    ...rtlText,
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  btnGhostText: {
    ...rtlText,
    color: colors.text,
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
    backgroundColor: "#1E293B",
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  toastSuccess: {
    backgroundColor: colors.success,
  },
  toastError: {
    backgroundColor: colors.danger,
  },
  toastText: {
    ...rtlText,
    width: "100%",
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
