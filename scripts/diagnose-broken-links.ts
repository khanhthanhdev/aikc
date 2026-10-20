#!/usr/bin/env bun
/**
 * Re-check every tool marked as broken and print why, without changing
 * anything. Read-only: it never writes to the database.
 *
 * Each link is checked twice:
 *  - the way the weekly link checker does it (`validateLink`), and
 *  - the way a visitor's browser would (GET, browser User-Agent, longer
 *    timeout).
 * Comparing the two tells a dead site apart from a false alarm, e.g. a site
 * that blocks bots but opens fine for people.
 *
 * Usage:
 *   bun run links:diagnose                       # All tools marked broken
 *   bun run links:diagnose --limit 20            # Only the first 20
 *   bun run links:diagnose --csv /tmp/links.csv  # Also write a CSV report
 *   bun run links:diagnose --url https://a.com   # Check one URL, no database
 */

import dns from "node:dns/promises";
import { writeFile } from "node:fs/promises";
import { validateLink } from "~/lib/link-validator";
import { prisma } from "~/services/prisma";

const getArg = (name: string) =>
  process.argv.includes(name)
    ? process.argv[process.argv.indexOf(name) + 1]
    : undefined;

const limitArg = getArg("--limit");
const LIMIT = limitArg === undefined ? undefined : Number(limitArg);
const CSV_PATH = getArg("--csv");
const SINGLE_URL = getArg("--url");

/** Parallel checks; low so the sites we test do not rate limit us. */
const CONCURRENCY = 5;
const BROWSER_TIMEOUT = 20_000;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type Verdict = "dead" | "false-alarm" | "check-by-hand";

/** What each category means, and whether the "broken" flag is deserved. */
const categories = {
  OK_NOW: {
    verdict: "false-alarm",
    meaning: "Works now; the flag is from an earlier check",
  },
  DOMAIN_GONE: {
    verdict: "dead",
    meaning: "Domain no longer exists",
  },
  DNS_LOOKUP_DIFFERS: {
    verdict: "false-alarm",
    meaning: "Domain resolves for browsers but not with the checker's DNS query",
  },
  NOT_FOUND: {
    verdict: "dead",
    meaning: "Page answers 404/410 (removed)",
  },
  PAYMENT_REQUIRED: {
    verdict: "dead",
    meaning: "Answers 402: hosting disabled for non-payment (e.g. Vercel)",
  },
  SSL: {
    verdict: "dead",
    meaning: "Invalid or expired HTTPS certificate (browser shows a warning)",
  },
  CONNECTION: {
    verdict: "dead",
    meaning: "Server refuses or drops the connection",
  },
  TIMEOUT: {
    verdict: "check-by-hand",
    meaning: `No answer within ${BROWSER_TIMEOUT / 1000}s, even for a browser`,
  },
  SLOW: {
    verdict: "false-alarm",
    meaning: "Opens for a browser, but slower than the checker's 5s timeout",
  },
  BOT_BLOCKED: {
    verdict: "false-alarm",
    meaning: "Blocks the checker (403/401/503) but opens for a browser",
  },
  RATE_LIMITED: {
    verdict: "false-alarm",
    meaning: "Answered 429 Too Many Requests",
  },
  CHECKER_ONLY: {
    verdict: "false-alarm",
    meaning: "Fails only for the checker (e.g. HEAD request), opens for a browser",
  },
  BLOCKED_FOR_ALL: {
    verdict: "check-by-hand",
    meaning: "Answers 401/403/503 even to a browser (often a captcha page)",
  },
  SERVER_ERROR: {
    verdict: "check-by-hand",
    meaning: "Server error (5xx)",
  },
  PRIVATE: {
    verdict: "dead",
    meaning: "Points to a private/internal address",
  },
  INVALID_URL: {
    verdict: "dead",
    meaning: "Website URL is malformed",
  },
  OTHER: {
    verdict: "check-by-hand",
    meaning: "Unclassified failure, see details",
  },
} satisfies Record<string, { verdict: Verdict; meaning: string }>;

type Category = keyof typeof categories;

const verdictIcons: Record<Verdict, string> = {
  dead: "✗",
  "false-alarm": "✓",
  "check-by-hand": "?",
};

type Probe = {
  status?: number;
  code?: string;
  message?: string;
  timedOut?: boolean;
};

type Diagnosis = {
  slug: string;
  url: string;
  lastCheckedAt: Date | null;
  category: Category;
  checker: string;
  browser: string;
};

const main = async () => {
  if (LIMIT !== undefined && !(Number.isInteger(LIMIT) && LIMIT > 0)) {
    throw new Error(`--limit must be a positive integer, got "${limitArg}"`);
  }

  console.log("🔗 Diagnose broken links (read-only, nothing is changed)\n");

  const tools = SINGLE_URL
    ? [{ slug: "(url)", websiteUrl: SINGLE_URL, lastCheckedAt: null }]
    : await prisma.tool.findMany({
        where: { isBroken: true },
        select: { slug: true, websiteUrl: true, lastCheckedAt: true },
        orderBy: { slug: "asc" },
        take: LIMIT,
      });

  console.log(`${tools.length} link(s) to check\n`);

  const diagnoses: Diagnosis[] = [];
  const queue = [...tools];
  let done = 0;

  const worker = async () => {
    for (let tool = queue.shift(); tool; tool = queue.shift()) {
      const diagnosis = await diagnose(tool);
      diagnoses.push(diagnosis);
      done++;

      const { verdict } = categories[diagnosis.category];
      console.log(
        `  [${done}/${tools.length}] ${verdictIcons[verdict]} ${diagnosis.category.padEnd(18)} ${tool.slug}`
      );
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  printReport(diagnoses);

  if (CSV_PATH) {
    await writeFile(CSV_PATH, toCsv(diagnoses));
    console.log(`\n📝 CSV written to ${CSV_PATH}`);
  }
};

const diagnose = async (tool: {
  slug: string;
  websiteUrl: string;
  lastCheckedAt: Date | null;
}): Promise<Diagnosis> => {
  const { slug, websiteUrl: url, lastCheckedAt } = tool;
  const result = (category: Category, checker: string, browser = "-") => ({
    slug,
    url,
    lastCheckedAt,
    category,
    checker,
    browser,
  });

  let hostname: string;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return result("INVALID_URL", `protocol ${parsed.protocol}`);
    }
    hostname = parsed.hostname;
  } catch {
    return result("INVALID_URL", "cannot parse URL");
  }

  // Exactly what the weekly job would decide today
  const checked = await validateLink(url);
  const checker = checked.isValid
    ? `OK ${checked.statusCode ?? ""}`.trim()
    : (checked.error ?? "failed");

  if (checked.isValid) {
    return result("OK_NOW", checker);
  }

  const dnsResult = await checkDns(hostname);
  if (dnsResult.gone) {
    return result("DOMAIN_GONE", checker, dnsResult.detail);
  }
  if (dnsResult.private) {
    return result("PRIVATE", checker, dnsResult.detail);
  }
  if (dnsResult.checkerFails) {
    return result("DNS_LOOKUP_DIFFERS", checker, dnsResult.detail);
  }

  const probe = await browserProbe(url);
  const browser = describeProbe(probe);
  const status = probe.status;
  const failure = `${probe.code ?? ""} ${probe.message ?? ""}`;

  if (status === undefined) {
    if (probe.timedOut) return result("TIMEOUT", checker, browser);
    if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|ALTNAME/i.test(failure)) {
      return result("SSL", checker, browser);
    }
    if (/REFUSED|RESET|UNREACH|CLOSED|EPIPE|SOCKET/i.test(failure)) {
      return result("CONNECTION", checker, browser);
    }
    return result("OTHER", checker, browser);
  }

  if (status === 404 || status === 410) {
    return result("NOT_FOUND", checker, browser);
  }
  if (status === 402) {
    return result("PAYMENT_REQUIRED", checker, browser);
  }
  if (status === 429 || checker.includes("429")) {
    return result("RATE_LIMITED", checker, browser);
  }

  // The browser got through, so the "broken" flag came from how the checker
  // asks, not from the site being down.
  if (status < 400) {
    if (/timeout/i.test(checker)) return result("SLOW", checker, browser);
    if (/HTTP (401|403|503)/.test(checker)) {
      return result("BOT_BLOCKED", checker, browser);
    }
    return result("CHECKER_ONLY", checker, browser);
  }

  if (status === 401 || status === 403 || status === 503) {
    return result("BLOCKED_FOR_ALL", checker, browser);
  }
  if (status >= 500) return result("SERVER_ERROR", checker, browser);

  return result("OTHER", checker, browser);
};

/**
 * Browsers use the OS resolver (`lookup`); the checker queries DNS servers
 * directly (`resolve4/6`). Comparing them separates a gone domain from a DNS
 * setup problem on the server.
 */
const checkDns = async (hostname: string) => {
  const lookup = await dns
    .lookup(hostname, { all: true })
    .then((addresses) => ({ addresses, code: undefined }))
    .catch((error: NodeJS.ErrnoException) => ({
      addresses: [],
      code: error.code,
    }));

  const resolved = await Promise.all([
    dns.resolve4(hostname).catch(() => [] as string[]),
    dns.resolve6(hostname).catch(() => [] as string[]),
  ]);
  const checkerAddresses = resolved.flat();

  const addresses = lookup.addresses.map(({ address }) => address);
  const isPrivate = addresses.some((address) =>
    /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd])/i.test(
      address
    )
  );

  return {
    gone:
      !addresses.length &&
      (lookup.code === "ENOTFOUND" || lookup.code === "ENODATA"),
    private: isPrivate,
    checkerFails: addresses.length > 0 && checkerAddresses.length === 0,
    detail: addresses.length
      ? `resolves to ${addresses.slice(0, 2).join(", ")}`
      : `DNS ${lookup.code ?? "failed"}`,
  };
};

const browserProbe = async (url: string): Promise<Probe> => {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(BROWSER_TIMEOUT),
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
      },
    });
    // Only the status matters; drop the body without reading it.
    await response.body?.cancel();
    return { status: response.status };
  } catch (error) {
    const err = error as Error & {
      code?: string;
      cause?: { code?: string; message?: string };
    };
    return {
      timedOut: err.name === "TimeoutError" || err.name === "AbortError",
      code: err.code ?? err.cause?.code,
      message: err.cause?.message ?? err.message,
    };
  }
};

const describeProbe = (probe: Probe) => {
  if (probe.status !== undefined) return `HTTP ${probe.status}`;
  if (probe.timedOut) return "timeout";
  return [probe.code, probe.message].filter(Boolean).join(": ") || "failed";
};

const printReport = (diagnoses: Diagnosis[]) => {
  const byCategory = Object.groupBy(diagnoses, ({ category }) => category);
  const verdictTotals: Record<Verdict, number> = {
    dead: 0,
    "false-alarm": 0,
    "check-by-hand": 0,
  };

  console.log("\n📋 Details");

  for (const category of Object.keys(categories) as Category[]) {
    const items = byCategory[category];
    if (!items?.length) continue;

    const { verdict, meaning } = categories[category];
    verdictTotals[verdict] += items.length;

    console.log(
      `\n${verdictIcons[verdict]} ${category} (${items.length}): ${meaning}`
    );
    for (const item of items) {
      console.log(`   ${item.slug}  ${item.url}`);
      console.log(`      checker: ${item.checker} | browser: ${item.browser}`);
    }
  }

  console.log("\n📊 Summary");
  console.log(`   ✗ Really broken:        ${verdictTotals.dead}`);
  console.log(`   ✓ False alarm:          ${verdictTotals["false-alarm"]}`);
  console.log(`   ? Check by hand:        ${verdictTotals["check-by-hand"]}`);
};

const toCsv = (diagnoses: Diagnosis[]) => {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const header = [
    "slug",
    "url",
    "verdict",
    "category",
    "meaning",
    "checker",
    "browser",
    "lastCheckedAt",
  ];
  const rows = diagnoses.map((item) => {
    const { verdict, meaning } = categories[item.category];
    return [
      item.slug,
      item.url,
      verdict,
      item.category,
      meaning,
      item.checker,
      item.browser,
      item.lastCheckedAt?.toISOString() ?? "",
    ]
      .map(escape)
      .join(",");
  });
  return `${[header.join(","), ...rows].join("\n")}\n`;
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
