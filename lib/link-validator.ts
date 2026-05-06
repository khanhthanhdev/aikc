import dns from "node:dns/promises";
import { URL } from "node:url";
import { createLogger } from "~/lib/logger";

const log = createLogger("link-validator");

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/i,
];

const REQUEST_TIMEOUT = 5000;
const USER_AGENT = "Mozilla/5.0 (compatible; LinkChecker/1.0)";

interface LinkValidationResult {
  error?: string;
  isValid: boolean;
  statusCode?: number;
}

/**
 * Check if an IP address is private/internal (SSRF protection)
 */
function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((pattern) => pattern.test(ip));
}

/**
 * Resolve hostname and check if it points to a private IP
 */
async function isPrivateHost(hostname: string): Promise<boolean> {
  if (isPrivateIP(hostname)) {
    return true;
  }

  try {
    const addresses = await dns.resolve4(hostname);
    return addresses.some((ip) => isPrivateIP(ip));
  } catch {
    try {
      const addresses = await dns.resolve6(hostname);
      return addresses.some((ip) => isPrivateIP(ip));
    } catch {
      return false;
    }
  }
}

/**
 * Validate URL format
 */
function isValidUrlFormat(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Check if a link is alive using HEAD request with fallback to GET
 */
export async function validateLink(url: string): Promise<LinkValidationResult> {
  log.debug(`Validating link: ${url}`);

  if (!isValidUrlFormat(url)) {
    log.warn(`Invalid URL format: ${url}`);
    return { isValid: false, error: "Invalid URL format" };
  }

  try {
    const parsed = new URL(url);

    // SSRF protection: check if hostname resolves to private IP
    if (await isPrivateHost(parsed.hostname)) {
      log.warn(`SSRF blocked - private host: ${parsed.hostname}`);
      return {
        isValid: false,
        error: "URL points to private/internal network",
      };
    }

    // Try HEAD request first (more efficient)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      log.debug(`Sending HEAD request to: ${url}`);
      let response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
      });

      // Some servers don't support HEAD, fallback to GET
      if (response.status === 405 || response.status === 501) {
        log.debug(`HEAD not supported, falling back to GET: ${url}`);
        response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": USER_AGENT },
          redirect: "follow",
        });
      }

      clearTimeout(timeoutId);

      if (response.ok) {
        log.info(`Link valid: ${url}`, { status: response.status });
        return { isValid: true, statusCode: response.status };
      }

      log.warn(`Link returned error: ${url}`, { status: response.status });
      return {
        isValid: false,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        log.warn(`Link timeout: ${url}`);
        return { isValid: false, error: "Request timeout" };
      }
      log.error(`Link validation failed: ${url}`, { error: error.message });
      return { isValid: false, error: error.message };
    }
    return { isValid: false, error: "Unknown error" };
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
