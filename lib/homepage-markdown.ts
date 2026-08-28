import { getAgentHomepageSummary } from "~/lib/homepage-agent-content";

const markdownTitles = {
  en: "Find the Perfect Work & Study Tools for You",
  vi: "Tìm Công Cụ Học Tập & Làm Việc Hoàn Hảo",
} as const;

const markdownBrowseSections = {
  en: `## Browse AI Knowledge Cloud

- [Tools](/en/tools): Search the published work and study tool catalog.
- [Categories](/en/categories): Browse tools by subject or use case.
- [Collections](/en/collections): Explore curated tool collections.
- [Developer resources](/en/developers): Read API, authentication, webhook, and MCP availability details.`,
  vi: `## Khám phá AI Knowledge Cloud

- [Công cụ](/vi/tools): Tìm trong danh mục công cụ học tập và làm việc đã xuất bản.
- [Danh mục](/vi/danh-muc): Duyệt công cụ theo môn học hoặc trường hợp sử dụng.
- [Bộ sưu tập](/vi/bo-suu-tap): Khám phá các bộ sưu tập công cụ được tuyển chọn.
- [Tài nguyên cho nhà phát triển](/vi/nha-phat-trien): Đọc thông tin về API, xác thực, webhook và MCP.`,
} as const;

export const getHomepageMarkdown = (locale: string): string => {
  const resolvedLocale = locale === "vi" ? "vi" : "en";

  return `# ${markdownTitles[resolvedLocale]}

${getAgentHomepageSummary(resolvedLocale)}

${markdownBrowseSections[resolvedLocale]}

## Machine-readable resources

- [OpenAPI specification](/openapi.json)
- [LLM resource index](/llms.txt)`;
};
