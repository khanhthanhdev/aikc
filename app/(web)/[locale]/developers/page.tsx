import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RagSandbox } from "~/app/(web)/[locale]/developers/rag-sandbox";
import { Prose } from "~/components/common/prose";
import { Intro, IntroDescription, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates, buildLocalizedUrl } from "~/utils/seo";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Developer" });

  return parseMetadata({
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates(locale, "/developers"),
    openGraph: { url: buildLocalizedUrl(locale, "/developers") },
  });
}

export default async function DeveloperResourcesPage({
  params,
}: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Developer" });

  return (
    <Wrapper size="sm">
      <Intro alignment="start">
        <IntroTitle>{t("title")}</IntroTitle>
        <IntroDescription>{t("description")}</IntroDescription>
      </Intro>

      <Prose>
        <h2>{t("apiTitle")}</h2>
        <p>{t("apiDescription")}</p>
        <p>
          <a href="/openapi.json">OpenAPI specification</a>
        </p>

        <h2>{t("quickstartTitle")}</h2>
        <p>{t("quickstartDescription")}</p>
        <pre>
          <code>{`curl --request POST https://aikc.vn/api/rag \\
  --header "Content-Type: application/json" \\
  --header "Origin: https://aikc.vn" \\
  --data '{"question":"Which tools help with note taking?"}'`}</code>
        </pre>

        <h2>{t("sandboxTitle")}</h2>
        <p>{t("sandboxDescription")}</p>
        <RagSandbox
          answerLabel={t("sandboxAnswerLabel")}
          errorLabel={t("sandboxError")}
          questionLabel={t("sandboxQuestionLabel")}
          questionPlaceholder={t("sandboxQuestionPlaceholder")}
          submitLabel={t("sandboxSubmit")}
        />

        <h2>{t("authTitle")}</h2>
        <p>{t("authDescription")}</p>

        <h2>{t("apiKeysTitle")}</h2>
        <p>{t("apiKeysDescription")}</p>

        <h2>{t("webhooksTitle")}</h2>
        <p>{t("webhooksDescription")}</p>

        <h2>{t("mcpTitle")}</h2>
        <p>{t("mcpDescription")}</p>

        <h2>{t("agentResourcesTitle")}</h2>
        <p>{t("llmsDescription")}</p>
        <p>
          <a href="/llms.txt">llms.txt</a>
        </p>
      </Prose>
    </Wrapper>
  );
}
