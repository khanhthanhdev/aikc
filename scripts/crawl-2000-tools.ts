import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import Firecrawl from "@mendable/firecrawl-js";

const OUTPUT_FILE = "./ai-tools-2000.txt";
const TARGET_COUNT = 2000;

const GITHUB_SOURCES = [
  { name: "mahseema/awesome-ai-tools", url: "https://raw.githubusercontent.com/mahseema/awesome-ai-tools/main/README.md" },
  { name: "eudk/awesome-ai-tools", url: "https://raw.githubusercontent.com/eudk/awesome-ai-tools/main/README.md" },
  { name: "ToolkitlyAI/awesome-ai-tools", url: "https://raw.githubusercontent.com/ToolkitlyAI/awesome-ai-tools/main/README.md" },
  { name: "shahedbd/awesome-ai-tools", url: "https://raw.githubusercontent.com/shahedbd/awesome-ai-tools/main/README.md" },
  { name: "kahkashanshaik/Awesome-AI-Tools", url: "https://raw.githubusercontent.com/kahkashanshaik/Awesome-AI-Tools/main/README.md" },
  { name: "steven2358/awesome-generative-ai", url: "https://raw.githubusercontent.com/steven2358/awesome-generative-ai/main/README.md" },
  { name: "e2b-dev/awesome-ai-agents", url: "https://raw.githubusercontent.com/e2b-dev/awesome-ai-agents/main/README.md" },
  { name: "tensorchord/Awesome-LLMOps", url: "https://raw.githubusercontent.com/tensorchord/Awesome-LLMOps/main/README.md" },
  { name: "maxbogo/awesome-ai-tools-for-ui", url: "https://raw.githubusercontent.com/maxbogo/awesome-ai-tools-for-ui/main/README.md" },
  { name: "ai-for-developers/awesome-ai-coding-tools", url: "https://raw.githubusercontent.com/ai-for-developers/awesome-ai-coding-tools/main/README.md" },
  { name: "yokoffing/awesome-ai", url: "https://raw.githubusercontent.com/yokoffing/awesome-ai/main/README.md" },
  { name: "liaokongVFX/awesome-ai-tools", url: "https://raw.githubusercontent.com/liaokongVFX/awesome-ai-tools/main/README.md" },
  { name: "sm174/awesome-ai-tools", url: "https://raw.githubusercontent.com/sm174/awesome-ai-tools/main/README.md" },
  { name: "ai-boost/awesome-prompts", url: "https://raw.githubusercontent.com/ai-boost/awesome-prompts/main/README.md" },
  { name: "formulahendry/awesome-gpt", url: "https://raw.githubusercontent.com/formulahendry/awesome-gpt/master/README.md" },
  { name: "humanloop/awesome-chatgpt", url: "https://raw.githubusercontent.com/humanloop/awesome-chatgpt/main/README.md" },
  { name: "f/awesome-chatgpt-prompts", url: "https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/README.md" },
  { name: "ai-collection/ai-collection", url: "https://raw.githubusercontent.com/ai-collection/ai-collection/main/README.md" },
  { name: "kyrolabs/awesome-langchain", url: "https://raw.githubusercontent.com/kyrolabs/awesome-langchain/main/README.md" },
  { name: "Shubhamsaboo/awesome-llm-apps", url: "https://raw.githubusercontent.com/Shubhamsaboo/awesome-llm-apps/main/README.md" },
  { name: "transitive-bullshit/agentic", url: "https://raw.githubusercontent.com/transitive-bullshit/agentic/main/readme.md" },
  { name: "underlord9510/awesome-ai-tools", url: "https://raw.githubusercontent.com/underlord9510/awesome-ai-tools/main/README.md" },
  { name: "alembic/awesome-ai", url: "https://raw.githubusercontent.com/alembic/awesome-ai/main/README.md" },
  { name: "wild-meta/awesome-ai-devtools", url: "https://raw.githubusercontent.com/wild-meta/awesome-ai-devtools/main/README.md" },
  { name: "Embra/awesome-ai-tools", url: "https://raw.githubusercontent.com/Embra/awesome-ai-tools/main/README.md" },
];

const SEARCH_QUERIES = [
  "top AI coding assistant software tools",
  "best AI code generator completion debugging tools",
  "best AI writing assistant copywriting blog tools",
  "best AI essay story novel content generator tools",
  "best AI video generator avatar animation tools",
  "best AI video editor clip maker shorts reels tools",
  "best AI voice generator text to speech voice cloning tools",
  "best AI music generator audio sound production tools",
  "best AI image generator photo editing graphic design tools",
  "best AI logo generator vector art design tools",
  "best AI 3D model generator rendering animation tools",
  "best AI presentation slides deck maker tools",
  "best AI spreadsheet excel formula automation tools",
  "best AI meeting notes transcription audio summarizer tools",
  "best AI customer support chatbot conversational agent tools",
  "best AI sales outreach lead generation cold email tools",
  "best AI email assistant inbox management triage tools",
  "best AI search engine research answer engine tools",
  "best AI PDF summarizer document question answering tools",
  "best AI homework tutor math solver learning tools",
  "best AI language learning speaking practice tools",
  "best AI resume CV builder cover letter generator tools",
  "best AI recruiting hiring candidate screening tools",
  "best AI legal contract review analysis compliance tools",
  "best AI accounting bookkeeping invoice finance tools",
  "best AI stock investing trading market research tools",
  "best AI health nutrition meal planner workout tools",
  "best AI mental health therapy mindfulness wellness tools",
  "best AI interior design room staging decor tools",
  "best AI architecture CAD floor plan generator tools",
  "best AI game development asset generator 2D 3D tools",
  "best AI fashion virtual try on clothing styling tools",
  "best AI travel itinerary vacation trip planner tools",
  "best AI social media post scheduler caption tools",
  "best AI SEO keyword ranking content optimization tools",
  "best AI ad banner creative copy generator tools",
  "best AI website builder landing page no code tools",
  "best AI app builder software development platform tools",
  "best AI workflow automation zapier make alternative tools",
  "best AI browser automation web scraping extraction tools",
  "best AI data analysis visualization SQL query tools",
  "best AI cybersecurity threat detection vulnerability tools",
  "best AI prompt engineering optimizer evaluation tools",
  "best AI autonomous agent framework multi-agent tools",
  "best AI synthetic data generation privacy tools",
  "best AI model fine tuning training deployment platform tools",
  "best AI observability monitoring tracing LLM tools",
  "best AI voice agent phone calling customer service tools",
  "best AI translation localization multilingual tools",
  "best AI podcast studio audio mastering sound tools",
  "best AI analytics dashboard insights tools",
  "best AI form builder survey generator tools",
  "best AI email finder prospecting outreach tools",
  "best AI contract management legal automation tools",
  "best AI diagram architecture flowchart generator tools",
  "best AI animation keyframe video generator tools",
  "best AI color palette gradient design tools",
  "best AI sound effect foley generator tools",
  "best AI quiz assessment test generator tools",
  "best AI knowledge base documentation generator tools",
];

const IGNORED_HOSTS = new Set([
  "github.com", "github.io", "gitlab.com", "bitbucket.org", "twitter.com", "x.com",
  "linkedin.com", "facebook.com", "instagram.com", "youtube.com", "youtu.be",
  "discord.gg", "discord.com", "reddit.com", "medium.com", "wikipedia.org",
  "arxiv.org", "t.me", "telegram.org", "google.com", "apple.com", "microsoft.com",
  "producthunt.com", "theresanaiforthat.com", "futurepedia.io", "toolify.ai",
  "altern.ai", "awesome.re", "shields.io", "badgen.net", "getrewardful.com", "pxf.io",
  "substack.com", "notion.so", "notion.site", "huggingface.co", "news.ycombinator.com",
  "openai.com", "anthropic.com", "amazon.com", "aws.amazon.com", "cloudflare.com"
]);

function cleanToolUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (
      IGNORED_HOSTS.has(hostname) ||
      hostname.endsWith(".github.io") ||
      hostname.includes("github") ||
      hostname.includes("twitter") ||
      hostname.includes("discord") ||
      hostname.includes("affiliate") ||
      hostname.includes("rewardful")
    ) {
      return null;
    }

    const path = parsed.pathname.toLowerCase();
    if (
      path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".jpeg") ||
      path.endsWith(".svg") || path.endsWith(".gif") || path.endsWith(".pdf") ||
      path.endsWith(".ico")
    ) {
      return null;
    }

    parsed.search = "";
    parsed.hash = "";

    // Keep clean origin (root tool URL)
    return parsed.origin;
  } catch {
    return null;
  }
}

async function main() {
  console.log("==================================================");
  console.log(`🎯 Harvesting ${TARGET_COUNT} Distinct AI Tool URLs`);
  console.log(`💾 Output: ${OUTPUT_FILE}`);
  console.log("==================================================\n");

  const collectedUrls = new Set<string>();

  // If file already exists, load existing URLs
  if (existsSync(OUTPUT_FILE)) {
    const lines = readFileSync(OUTPUT_FILE, "utf8")
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith("#"));
    for (const l of lines) {
      collectedUrls.add(l);
    }
    console.log(`📂 Loaded ${collectedUrls.size} existing URLs from ${OUTPUT_FILE}`);
  }

  // ── Phase 1: GitHub Awesome AI Repos ──────────────────────────────────────
  console.log(`\n🚀 [Phase 1] Extracting from GitHub Awesome AI Repositories...`);
  for (const source of GITHUB_SOURCES) {
    if (collectedUrls.size >= TARGET_COUNT) break;

    try {
      process.stdout.write(`  📥 ${source.name}... `);
      const res = await fetch(source.url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        console.log(`(HTTP ${res.status})`);
        continue;
      }
      const markdown = await res.text();
      // Match both markdown [title](url) and plain https:// URLs in markdown tables/lists
      const linkRegex = /(?:\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)|<(https?:\/\/[^\s>]+)>|(https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s)\]"'>]*)?))/g;
      let match: RegExpExecArray | null;
      let added = 0;

      while ((match = linkRegex.exec(markdown)) !== null) {
        if (collectedUrls.size >= TARGET_COUNT) break;
        const rawUrl = match[2] || match[3] || match[4];
        if (!rawUrl) continue;
        const candidate = cleanToolUrl(rawUrl);
        if (candidate && !collectedUrls.has(candidate)) {
          collectedUrls.add(candidate);
          appendFileSync(OUTPUT_FILE, `${candidate}\n`);
          added++;
        }
      }
      console.log(`+${added} tools (Total: ${collectedUrls.size}/${TARGET_COUNT})`);
    } catch (e) {
      console.log(`(Error: ${e instanceof Error ? e.message : e})`);
    }
  }

  // ── Phase 2: Firecrawl Search Expansion ────────────────────────────────────
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (apiKey && collectedUrls.size < TARGET_COUNT) {
    console.log(`\n🔍 [Phase 2] Expanding via Firecrawl Search across ${SEARCH_QUERIES.length} niches...`);
    const firecrawl = new Firecrawl({ apiKey });

    for (let i = 0; i < SEARCH_QUERIES.length; i++) {
      if (collectedUrls.size >= TARGET_COUNT) break;

      // Rate limit delay: max 30 searches/min -> 2200ms spacing
      await new Promise(r => setTimeout(r, 2200));

      const query = SEARCH_QUERIES[i];
      process.stdout.write(`  [${i + 1}/${SEARCH_QUERIES.length}] Searching: "${query.slice(0, 40)}..." `);

      try {
        const searchRes = await firecrawl.search(query, {
          limit: 30,
          sources: ["web"],
        });

        if (searchRes.success && searchRes.data) {
          const items = Array.isArray(searchRes.data)
            ? searchRes.data
            : (searchRes.data as any).web || [];

          let added = 0;
          for (const item of items) {
            if (collectedUrls.size >= TARGET_COUNT) break;
            const candidate = cleanToolUrl(item.url);
            if (candidate && !collectedUrls.has(candidate)) {
              collectedUrls.add(candidate);
              appendFileSync(OUTPUT_FILE, `${candidate}\n`);
              added++;
            }
          }
          console.log(`+${added} tools (Total: ${collectedUrls.size}/${TARGET_COUNT})`);
        } else {
          console.log(`(No items)`);
        }
      } catch (err) {
        console.log(`(Query error: ${err instanceof Error ? err.message : err})`);
      }
    }
  }

  console.log("\n==================================================");
  console.log(`🎉 Collection Complete! Total: ${collectedUrls.size} distinct tools`);
  console.log(`📁 File: ${OUTPUT_FILE}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
