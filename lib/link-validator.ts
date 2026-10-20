import dns from "node:dns/promises";
import net from "node:net";
import { URL } from "node:url";
import { createLogger } from "~/lib/logger";

const log = createLogger("link-validator");

const REQUEST_TIMEOUT = 5000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Mozilla/5.0 (compatible; LinkChecker/1.0)";

/**
 * A link only counts as broken on proof that visitors cannot use it. These
 * statuses say nothing about that: bot protection (401/403/503) and rate
 * limits (429) block the checker while the site works fine for people.
 */
const INCONCLUSIVE_STATUS_CODES = new Set([401, 403, 429, 503]);
// 402: hosts like Vercel answer "Payment required / DEPLOYMENT_DISABLED" once
// the owner stops paying, so the site is gone for everyone.
const BROKEN_STATUS_CODES = new Set([402, 404, 410]);

const PRIVATE_NETWORK_ERROR = "URL points to private/internal network";
const DOMAIN_NOT_FOUND = "Domain not found";
const DNS_ERROR = "DNS lookup error";

/** Answers that prove the name does not exist, not that the resolver failed. */
const NO_SUCH_DOMAIN_CODES = new Set(["ENOTFOUND", "ENODATA"]);

const TLS_ERROR_PATTERN =
  /CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|ALTNAME|HANDSHAKE/i;
const CONNECTION_ERROR_PATTERN =
  /REFUSED|RESET|UNREACH|EHOSTDOWN|ConnectionClosed|Unable to connect/i;

/**
 * A lapsed domain is often parked: it answers 200 with a registrar's ad or
 * "for sale" page, so only the page itself shows the tool is gone.
 */
const PARKED_DOMAIN = "Parked domain";
/** Domain marketplaces a lapsed domain redirects to. */
const DOMAIN_MARKETPLACE_HOST =
  /(^|\.)(afternic\.com|atom\.com|brandforce\.com|dan\.com|hugedomains\.com|sedo\.com|squadhelp\.com|undeveloped\.com)$/i;
const PARKED_PAGE_PATTERNS = [
  // GoDaddy: a stub that sends the browser to /lander, then the parking app
  /window\.location\.href\s*=\s*["']\/lander["']/,
  /wsimg\.com\/parking-lander/,
  /sedoparking\.com|parkingcrew\.net|parking\.bodiscdn\.com/i,
  /\b(this )?domain (name )?(is|may be) (parked|for sale)\b/i,
];
/** Parking pages are small; their markers sit near the top. */
const PARKED_PAGE_MAX_BYTES = 64 * 1024;

interface LinkValidationResult {
  error?: string;
  isValid: boolean;
  statusCode?: number;
}

/**
 * IPv4 ranges that must never be reachable from the server.
 * Includes RFC1918, loopback, link-local, CGNAT, broadcast, multicast,
 * benchmarking, documentation, and reserved blocks.
 */
const PRIVATE_IPV4_CIDRS: Array<[bigint, number]> = [
  [ipv4ToBigInt("0.0.0.0"), 8], // "this network"
  [ipv4ToBigInt("10.0.0.0"), 8], // RFC1918
  [ipv4ToBigInt("100.64.0.0"), 10], // CGNAT
  [ipv4ToBigInt("127.0.0.0"), 8], // loopback
  [ipv4ToBigInt("169.254.0.0"), 16], // link-local + AWS/GCP IMDS
  [ipv4ToBigInt("172.16.0.0"), 12], // RFC1918
  [ipv4ToBigInt("192.0.0.0"), 24], // IETF Protocol assignments
  [ipv4ToBigInt("192.0.2.0"), 24], // TEST-NET-1
  [ipv4ToBigInt("192.168.0.0"), 16], // RFC1918
  [ipv4ToBigInt("198.18.0.0"), 15], // benchmarking
  [ipv4ToBigInt("198.51.100.0"), 24], // TEST-NET-2
  [ipv4ToBigInt("203.0.113.0"), 24], // TEST-NET-3
  [ipv4ToBigInt("224.0.0.0"), 4], // multicast
  [ipv4ToBigInt("240.0.0.0"), 4], // reserved
  [ipv4ToBigInt("255.255.255.255"), 32], // broadcast
];

function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split(".").map((p) => BigInt(Number.parseInt(p, 10)));
  return (
    (parts[0]! << 24n) | (parts[1]! << 16n) | (parts[2]! << 8n) | parts[3]!
  );
}

function inCidr(addr: bigint, base: bigint, prefix: number, bits: number) {
  const mask =
    prefix === 0
      ? 0n
      : ((1n << BigInt(bits)) - 1n) ^ ((1n << BigInt(bits - prefix)) - 1n);
  return (addr & mask) === (base & mask);
}

function isPrivateIPv4(ip: string): boolean {
  if (net.isIPv4(ip) === false) {
    return false;
  }
  const addr = ipv4ToBigInt(ip);
  return PRIVATE_IPV4_CIDRS.some(([base, prefix]) =>
    inCidr(addr, base, prefix, 32)
  );
}

function isPrivateIPv6(ip: string): boolean {
  if (net.isIPv6(ip) === false) {
    return false;
  }
  const lower = ip.toLowerCase();

  // Loopback ::1
  if (lower === "::1") {
    return true;
  }
  // Unspecified
  if (lower === "::") {
    return true;
  }
  // Unique local fc00::/7
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) {
    return true;
  }
  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/.test(lower)) {
    return true;
  }
  // Multicast ff00::/8
  if (lower.startsWith("ff")) {
    return true;
  }
  // IPv4-mapped ::ffff:a.b.c.d
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped?.[1] && net.isIPv4(mapped[1])) {
    return isPrivateIPv4(mapped[1]);
  }
  // IPv4-mapped hex form ::ffff:xxxx:xxxx
  const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const a = Number.parseInt(hexMapped[1]!, 16);
    const b = Number.parseInt(hexMapped[2]!, 16);
    const ipv4 = `${(a >> 8) & 0xff}.${a & 0xff}.${(b >> 8) & 0xff}.${b & 0xff}`;
    return isPrivateIPv4(ipv4);
  }
  return false;
}

function isPrivateIP(ip: string): boolean {
  return isPrivateIPv4(ip) || isPrivateIPv6(ip);
}

/**
 * Resolve a hostname to all of its A and AAAA records and ensure none of
 * them point at private/internal addresses.
 */
async function resolveAndCheckHost(hostname: string): Promise<{
  safe: boolean;
  reason?: string;
}> {
  // Normalize and reject obvious local names
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".internal")
  ) {
    return { safe: false, reason: "blocked hostname" };
  }

  // If the hostname is itself an IP literal, validate it directly
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      return { safe: false, reason: "private IP literal" };
    }
    return { safe: true };
  }

  const errorCodes: string[] = [];
  const collectError = (error: NodeJS.ErrnoException) => {
    errorCodes.push(error.code ?? "UNKNOWN");
    return [] as string[];
  };

  const [v4, v6] = await Promise.all([
    dns.resolve4(hostname).catch(collectError),
    dns.resolve6(hostname).catch(collectError),
  ]);

  const all = [...v4, ...v6];
  if (all.length === 0) {
    // A resolver that is down or timing out says nothing about the site.
    const domainGone = errorCodes.every((code) =>
      NO_SUCH_DOMAIN_CODES.has(code)
    );
    return {
      safe: false,
      reason: domainGone
        ? DOMAIN_NOT_FOUND
        : `${DNS_ERROR} (${errorCodes.join(", ")})`,
    };
  }
  if (all.some((ip) => isPrivateIP(ip))) {
    return { safe: false, reason: "resolves to private IP" };
  }
  return { safe: true };
}

function isValidUrlFormat(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetch a URL once, manually following redirects so we can re-validate the
 * target of every hop. This blocks redirect-based SSRF (e.g. a public URL
 * that 302s to http://169.254.169.254).
 */
async function safeFetch(
  initialUrl: string,
  method: "HEAD" | "GET"
): Promise<Response> {
  let currentUrl = initialUrl;
  let redirects = 0;

  while (true) {
    const parsed = new URL(currentUrl);
    const check = await resolveAndCheckHost(parsed.hostname);
    if (!check.safe) {
      throw new Error(`SSRF blocked (${check.reason}): ${parsed.hostname}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method,
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
        redirect: "manual",
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 3xx with Location -> re-validate next hop
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location")
    ) {
      if (redirects >= MAX_REDIRECTS) {
        throw new Error("Too many redirects");
      }
      const next = new URL(
        response.headers.get("location")!,
        currentUrl
      ).toString();
      currentUrl = next;
      redirects++;
      continue;
    }

    return response;
  }
}

/** Whether the link ended up on a domain marketplace (another host). */
function redirectsToMarketplace(url: string, response: Response): boolean {
  if (!response.url) {
    return false;
  }
  const finalHost = new URL(response.url).hostname;
  return (
    finalHost !== new URL(url).hostname &&
    DOMAIN_MARKETPLACE_HOST.test(finalHost)
  );
}

/** The start of a response body as text, giving up after the request timeout. */
async function readBodyStart(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const timeoutId = setTimeout(() => reader.cancel(), REQUEST_TIMEOUT);
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (text.length < PARKED_PAGE_MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    clearTimeout(timeoutId);
    reader.cancel().catch(() => {});
  }
  return text;
}

/**
 * Whether a link that answered fine lands on a parked or for-sale page.
 * `response` is the final hop; its body is read here when it came from GET,
 * otherwise the page is fetched again with GET. Any failure counts as not
 * parked, since the link itself already answered.
 */
async function isParkedDomain(
  url: string,
  response: Response,
  method: "HEAD" | "GET"
): Promise<boolean> {
  try {
    if (redirectsToMarketplace(url, response)) {
      return true;
    }

    const page = method === "GET" ? response : await safeFetch(url, "GET");
    if (!page.ok || !page.headers.get("content-type")?.includes("html")) {
      await page.body?.cancel();
      return false;
    }
    const body = await readBodyStart(page);
    return PARKED_PAGE_PATTERNS.some((pattern) => pattern.test(body));
  } catch {
    return false;
  }
}

/**
 * Check if a link is alive using HEAD request with fallback to GET.
 * SSRF-safe: every redirect hop is re-validated against the private IP list.
 *
 * Broken: malformed or private URL, domain gone, parked or for-sale domain,
 * 402/404/410, 5xx (not 503), invalid TLS certificate, refused connection.
 * Not broken, only inconclusive
 * (`isValid: true` with the reason in `error`): 401/403/429/503, timeouts,
 * DNS resolver failures and any other status or error.
 */
export async function validateLink(url: string): Promise<LinkValidationResult> {
  log.debug(`Validating link: ${url}`);

  if (!isValidUrlFormat(url)) {
    log.warn(`Invalid URL format: ${url}`);
    return { isValid: false, error: "Invalid URL format" };
  }

  try {
    let response: Response;
    let method: "HEAD" | "GET" = "HEAD";
    try {
      response = await safeFetch(url, "HEAD");
      // Many servers reject or mishandle HEAD, so confirm a failure with GET
      // before trusting it.
      if (!response.ok) {
        log.debug(`HEAD got ${response.status}, retrying with GET: ${url}`);
        method = "GET";
        response = await safeFetch(url, "GET");
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("SSRF blocked")) {
        log.warn(error.message);
        if (error.message.includes(DOMAIN_NOT_FOUND)) {
          return { isValid: false, error: DOMAIN_NOT_FOUND };
        }
        // The host could not be checked, so it was not fetched either.
        if (error.message.includes(DNS_ERROR)) {
          return { isValid: true, error: DNS_ERROR };
        }
        return { isValid: false, error: PRIVATE_NETWORK_ERROR };
      }
      throw error;
    }

    const { status } = response;

    // Marketplaces may block the checker too, so the redirect alone decides.
    const parked = response.ok
      ? await isParkedDomain(url, response, method)
      : redirectsToMarketplace(url, response);
    if (parked) {
      log.warn(`Link lands on a parked or for-sale page: ${url}`, { status });
      return { isValid: false, statusCode: status, error: PARKED_DOMAIN };
    }

    if (response.ok) {
      await response.body?.cancel().catch(() => {});
      log.info(`Link valid: ${url}`, { status });
      return { isValid: true, statusCode: status };
    }

    const isBroken =
      BROKEN_STATUS_CODES.has(status) ||
      (status >= 500 && !INCONCLUSIVE_STATUS_CODES.has(status));

    if (isBroken) {
      log.warn(`Link returned error: ${url}`, { status });
    } else {
      log.info(`Link inconclusive, not counted as broken: ${url}`, { status });
    }

    return { isValid: !isBroken, statusCode: status, error: `HTTP ${status}` };
  } catch (error) {
    if (!(error instanceof Error)) {
      return { isValid: true, error: "Unknown error" };
    }

    if (error.name === "AbortError" || error.name === "TimeoutError") {
      log.warn(`Link timeout, not counted as broken: ${url}`);
      return { isValid: true, error: "Request timeout" };
    }

    // Bun puts the code on the error, Node on its `cause`.
    const { code, cause } = error as Error & {
      code?: string;
      cause?: { code?: string; message?: string };
    };
    const detail = [code, cause?.code, error.message, cause?.message]
      .filter(Boolean)
      .join(" ");

    if (TLS_ERROR_PATTERN.test(detail)) {
      log.warn(`Link has an invalid TLS certificate: ${url}`, { detail });
      return {
        isValid: false,
        error: `TLS error: ${code ?? cause?.code ?? error.message}`,
      };
    }

    if (CONNECTION_ERROR_PATTERN.test(detail)) {
      log.warn(`Link refused the connection: ${url}`, { detail });
      return {
        isValid: false,
        error: `Connection failed: ${code ?? cause?.code ?? error.message}`,
      };
    }

    log.warn(`Link check failed, not counted as broken: ${url}`, { detail });
    return { isValid: true, error: error.message };
  }
}

/**
 * Batch validate multiple links
 */
export async function validateLinks(
  urls: string[]
): Promise<Map<string, LinkValidationResult>> {
  const results = new Map<string, LinkValidationResult>();
  const validations = await Promise.allSettled(
    urls.map(async (url) => ({
      url,
      result: await validateLink(url),
    }))
  );

  for (const validation of validations) {
    if (validation.status === "fulfilled") {
      results.set(validation.value.url, validation.value.result);
    }
  }

  return results;
}
