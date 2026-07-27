import { Screen, Title, Muted, Card } from "@/src/components/ui";
import { t } from "@/src/i18n/ar";

export default function AboutScreen() {
  return (
    <Screen>
      <Title>{t("about")}</Title>
      <Card>
        <Muted>{t("aboutText")}</Muted>
        <Muted>الإصدار 1.0.0</Muted>
      </Card>
    </Screen>
  );
}
