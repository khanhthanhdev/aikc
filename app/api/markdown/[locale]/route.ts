import { getHomepageMarkdown } from "~/lib/homepage-markdown";
import {
  MARKDOWN_MEDIA_TYPE,
  MARKDOWN_VARY_HEADER,
} from "~/lib/markdown-negotiation";

interface RouteContext {
  params: Promise<{ locale: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { locale } = await params;
  if (locale !== "en" && locale !== "vi") {
    return new Response("Not found\n", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Vary: MARKDOWN_VARY_HEADER,
      },
    });
  }

  return new Response(getHomepageMarkdown(locale), {
    headers: {
      "Content-Type": `${MARKDOWN_MEDIA_TYPE}; charset=utf-8`,
      Vary: MARKDOWN_VARY_HEADER,
    },
  });
}
