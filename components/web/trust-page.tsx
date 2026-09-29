import { Prose } from "~/components/common/prose";
import { Intro, IntroTitle } from "~/components/web/ui/intro";
import { Wrapper } from "~/components/web/ui/wrapper";
import type { TrustPageName } from "~/lib/trust-page-content";
import { getTrustPageContent } from "~/lib/trust-page-content";

type TrustPageProps = {
  title: string;
  page: TrustPageName;
  locale: string;
};

export const TrustPage = ({ title, page, locale }: TrustPageProps) => {
  const content = getTrustPageContent(page, locale);

  return (
    <Wrapper size="sm">
      <Intro alignment="start">
        <IntroTitle>{title}</IntroTitle>
      </Intro>

      <Prose>
        {content.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </Prose>
    </Wrapper>
  );
};
