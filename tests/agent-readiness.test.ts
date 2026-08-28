import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET, POST } from "~/app/api/[...path]/route";
import {
  type ApiErrorCode,
  apiErrorCodes,
  apiErrorResponse,
  invalidRequestResponse,
} from "~/lib/api-error";
import { getAgentHomepageSummary } from "~/lib/homepage-agent-content";
import { GET as getHomepageMarkdownResponse } from "~/app/api/markdown/[locale]/route";
import { getStaticSitemapEntries } from "~/lib/sitemap";
import { getTrustPageContent } from "~/lib/trust-page-content";
import {
  appendMarkdownVary,
  MARKDOWN_MEDIA_TYPE,
  preferredRepresentation,
} from "~/lib/markdown-negotiation";
import { config } from "~/config";
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
} from "~/lib/json-ld";
import { parseMetadata } from "~/utils/metadata";
import { buildAlternates } from "~/utils/seo";

const readJson = async <T>(response: Response): Promise<T> => {
  assert.match(
    response.headers.get("content-type") ?? "",
    /application\/json/
  );
  return (await response.json()) as T;
};

test("homepage summaries provide meaningful server-rendered content", () => {
  for (const locale of ["en", "vi"]) {
    const summary = getAgentHomepageSummary(locale);
    assert.ok(summary.length >= 500);
    assert.ok(summary.includes("AI Knowledge Cloud"));
  }
});

test("OpenAPI document is valid JSON and describes the RAG contract", async () => {
  const document = JSON.parse(
    await readFile("public/openapi.json", "utf8")
  ) as {
    openapi: string;
    paths: {
      "/api/rag": {
        get: { operationId: string };
        post: { operationId: string };
      };
    };
    components: { schemas: { ApiError: unknown } };
  };

  assert.equal(document.openapi, "3.1.1");
  assert.equal(
    document.paths["/api/rag"].get.operationId,
    "retrieveToolContext"
  );
  assert.equal(
    document.paths["/api/rag"].post.operationId,
    "answerToolQuestion"
  );
  assert.ok(document.components.schemas.ApiError);
});

test("API errors include a code, message, and resolution hint", async () => {
  const response = invalidRequestResponse({ field: "query" });
  const body = await readJson<{
    error: {
      code: ApiErrorCode;
      message: string;
      hint: string;
      details: unknown;
    };

  }>(response);
  assert.equal(response.status, 400);
  assert.deepEqual(body.error, {
    code: "INVALID_REQUEST",
    message: "The request is invalid.",
    hint: "Send valid JSON that matches the endpoint schema documented at /openapi.json.",
    details: { field: "query" },
  });
  assert.ok(apiErrorCodes.includes(body.error.code));
});

test("unknown API endpoints return JSON errors for supported and unsupported methods", async () => {
  const notFound = GET();
  const notFoundBody = await readJson<{
    error: { code: string; hint: string };
  }>(notFound);
  assert.equal(notFound.status, 404);
  assert.equal(notFoundBody.error.code, "NOT_FOUND");
  assert.ok(notFoundBody.error.hint.includes("/openapi.json"));

  const methodNotAllowed = POST();
  const methodNotAllowedBody = await readJson<{
    error: { code: string; hint: string };
  }>(methodNotAllowed);
  assert.equal(methodNotAllowed.status, 405);
  assert.equal(methodNotAllowed.headers.get("allow"), "GET");
  assert.equal(methodNotAllowedBody.error.code, "METHOD_NOT_ALLOWED");
});

test("all documented error codes can be serialized as JSON", async () => {
  for (const code of apiErrorCodes) {
    const response = apiErrorResponse({
      status: 400,
      code,
      message: "Message",
      hint: "Resolution hint",
    });
    const body = await readJson<{
      error: { code: string; message: string; hint: string };
    }>(response);

    assert.equal(body.error.code, code);
    assert.equal(body.error.message, "Message");
    assert.equal(body.error.hint, "Resolution hint");
  }
});

test("Markdown negotiation honors quality values and explicit rejections", () => {
  assert.equal(preferredRepresentation("text/markdown"), MARKDOWN_MEDIA_TYPE);
  assert.equal(
    preferredRepresentation("text/html;q=0.2, text/markdown;q=0.8"),
    MARKDOWN_MEDIA_TYPE
  );
  assert.equal(
    preferredRepresentation("text/html, text/markdown"),
    "text/html"
  );
  assert.equal(
    preferredRepresentation("text/markdown;q=0, */*;q=1"),
    "text/html"
  );
  assert.equal(preferredRepresentation("application/json"), null);
});

test("Markdown representations vary by Accept and return Markdown", async () => {
  const headers = new Headers({ Vary: "RSC, Accept-Encoding" });
  appendMarkdownVary(headers);
  assert.equal(headers.get("Vary"), "RSC, Accept-Encoding, Accept");

  const response = await getHomepageMarkdownResponse(new Request("https://aikc.vn/en"), {
    params: Promise.resolve({ locale: "en" }),
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "text/markdown; charset=utf-8"
  );
  assert.equal(response.headers.get("Vary"), "Accept, Accept-Encoding");
  assert.match(body, /^# Find the Perfect Work & Study Tools for You/m);
  assert.ok(body.length >= 500);
});

test("llms.txt indexes developer and trust resources", async () => {
  const llms = await readFile("public/llms.txt", "utf8");

  assert.ok(llms.startsWith("# AI Knowledge Cloud\n\n> "));
  assert.match(llms, /^## Developer Resources$/m);
  assert.match(llms, /\[AI Knowledge Cloud OpenAPI specification\]/);
  assert.match(llms, /authentication policy, webhook availability, and MCP server status/);
  assert.match(llms, /^## Trust Resources$/m);
  assert.match(llms, /\[Contact AI Knowledge Cloud\]/);
  assert.match(llms, /\[AI Knowledge Cloud Privacy Policy\]/);
});

test("agent discovery metadata includes canonical, language, and Open Graph signals", async () => {
  const metadata = parseMetadata({
    alternates: buildAlternates("en", "/"),
  });
  const rootLayout = await readFile("app/layout.tsx", "utf8");
  const openGraph = metadata.openGraph as {
    images: Array<{ url: string }>;
    type: string;
  };

  assert.match(rootLayout, /lang=\{routing\.defaultLocale\}/);

  assert.equal(metadata.alternates?.canonical, `${config.site.url}/en`);
  assert.equal(openGraph.type, "website");
  assert.deepEqual(openGraph.images, [
    { url: `${config.site.url}/opengraph.png`, width: 1200, height: 630 },
  ]);
});

test("sitemap lists public trust pages with last-modified dates", async () => {
  const entries = getStaticSitemapEntries();
  const urls = entries.map((entry) => entry.url);
  const sitemapRoute = await readFile("app/sitemap.ts", "utf8");

  assert.ok(urls.some((url) => url.endsWith("/en/about")));
  assert.ok(urls.some((url) => url.endsWith("/en/contact")));
  assert.ok(urls.some((url) => url.endsWith("/en/privacy")));
  assert.ok(entries.every((entry) => entry.lastModified instanceof Date));
  assert.match(sitemapRoute, /dynamic = "force-dynamic"/);
});

test("trust anchor copy is substantial in every supported language", () => {
  for (const page of ["contact", "privacy"] as const) {
    for (const locale of ["en", "vi"]) {
      const content = getTrustPageContent(page, locale);
      const text = content
        .flatMap((section) => section.paragraphs)
        .join(" ");

      assert.ok(text.length >= 500);
    }
  }
});

test("identity schemas include contact and postal address details", () => {
  const organization = buildOrganizationSchema() as unknown as {
    "@id": string;
    address: {
      "@type": string;
      addressCountry: string;
      addressLocality: string;
      addressRegion: string;
      streetAddress: string;
    };
    alternateName: string[];
    contactPoint: {
      "@type": string;
      availableLanguage: string[];
      contactType: string;
      email: string;
      telephone: string;
    };
    description: string;
    url: string;
  };
  const website = buildWebSiteSchema() as unknown as {
    "@id": string;
    alternateName: string[];
  };

  assert.deepEqual(organization.alternateName, ["AIKC", "AI Knowledge Cloud"]);
  assert.equal(organization["@id"], `${config.site.url}/#organization`);
  assert.equal(organization.url, config.site.url);
  assert.equal(organization.description, config.site.description);
  assert.deepEqual(organization.contactPoint, {
    "@type": "ContactPoint",
    email: config.site.email,
    telephone: config.site.contact.telephone,
    contactType: config.site.contact.contactType,
    availableLanguage: ["en", "vi"],
  });
  assert.deepEqual(organization.address, {
    "@type": "PostalAddress",
    ...config.site.contact.address,
  });
  assert.deepEqual(website.alternateName, ["AIKC", "AI Knowledge Cloud"]);
  assert.equal(website["@id"], `${config.site.url}/#website`);
  assert.ok(config.site.keywords.includes("AIKC"));
});

test("developer portal exposes a quickstart and interactive RAG sandbox", async () => {
  const page = await readFile(
    "app/(web)/[locale]/developers/page.tsx",
    "utf8"
  );
  const sandbox = await readFile(
    "app/(web)/[locale]/developers/rag-sandbox.tsx",
    "utf8"
  );

  assert.match(page, /quickstartTitle/);
  assert.match(page, /<RagSandbox/);
  assert.match(page, /https:\/\/aikc\.vn\/api\/rag/);
  assert.match(sandbox, /fetch\("\/api\/rag"/);
  assert.match(sandbox, /method: "POST"/);
  assert.match(sandbox, /aria-live="polite"/);
});
