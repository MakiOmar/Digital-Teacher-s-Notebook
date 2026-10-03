import * as Application from "expo-application";
import Constants from "expo-constants";
import { Screen, Title, Muted, Card } from "@/src/components/ui";
import { t } from "@/src/i18n/ar";

/** Installed binary version first; app.json fallback covers web / Expo Go. */
function versionLabel(): string {
  const version =
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version;
  if (!version) return "";
  const build = Application.nativeBuildVersion;
  return build
    ? t("appVersionWithBuild", { version, build })
    : t("appVersion", { version });
}

export default function AboutScreen() {
  const version = versionLabel();
  return (
    <Screen>
      <Title>{t("about")}</Title>
      <Card>
        <Muted>{t("appName")}</Muted>
        <Muted>{t("aboutText")}</Muted>
        {version ? <Muted>{version}</Muted> : null}
      </Card>
    </Screen>
  );
}
