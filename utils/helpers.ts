/**
 * Adds UTM tracking to the provided link
 * It uses the search params and accepts source, medium and campaign which are optional
 * It should not strip any existing search params
 */
export const addUTMTracking = (
  url: string,
  utm: { source: string; medium?: string; campaign?: string }
) => {
  const urlObj = new URL(url);
  const searchParams = urlObj.searchParams;

  if (utm.source) {
    searchParams.set("utm_source", utm.source);
  }
  if (utm.medium) {
    searchParams.set("utm_medium", utm.medium);
  }
  if (utm.campaign) {
    searchParams.set("utm_campaign", utm.campaign);
  }

  urlObj.search = searchParams.toString();
  return urlObj.toString();
};

/**
 * Sanitizes user input by stripping HTML tags, event handlers, and unsafe characters.
 * Defense-in-depth — HTML-encodes angle brackets and quotes as a final layer.
 */
export const sanitizeText = (input: string, maxLength = 10_000) => {
  return (
    input
      .trim()
      // Decode HTML entities first to catch encoded attacks (e.g. &#60;script&#62;)
      .replace(/&#x?([0-9a-f]+);?/gi, "")
      .replace(/&\w+;/g, "")
      // Strip HTML/script tags
      .replace(/<[^>]*>/g, "")
      .replace(/[<>]/g, "")
      // Strip inline event handlers (onclick, onerror, onload, etc.)
      .replace(/on\w+\s*=\s*/gi, "")
      // Block URI-based XSS vectors (javascript:, data:text/html, vbscript:)
      .replace(/(javascript|data|vbscript):/gi, "")
      // Strip expression() and url() CSS-based XSS
      .replace(/(expression|url)\s*\([^)]*\)/gi, "")
      // Strip import() ECMAScript module injection
      .replace(/import\s*\([^)]*\)/gi, "")
      .slice(0, maxLength)
  );
};

/**
 * Sanitizes URLs by trimming and blocking unsafe protocols.
 * Only allows http:// and https:// to prevent javascript:, data:, vbscript: attacks.
 * Returns empty string for invalid/unsafe URLs.
 */
export const sanitizeUrl = (url: string) => {
  const trimmed = url.trim();

  // Block URI-based XSS vectors before URL parsing
  if (/^(javascript|data|vbscript|file|ftp):/i.test(trimmed)) {
    return "";
  }

  // Validate as proper URL with safe protocol
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
type JsonContainer = JsonValue[] | { [key: string]: JsonValue };
type IsBroadJsonValue<T> =
  unknown extends NonNullable<T>
    ? false
    : [JsonContainer] extends [NonNullable<T>]
      ? true
      : false;
type NullsToUndefined<T> =
  IsBroadJsonValue<T> extends true
    ? // Prisma JsonValue fields are intentionally left dynamic; recursively
      // expanding them breaks callers that pass model objects into form defaults.
      unknown
    : T extends null | undefined
      ? undefined
      : T extends Date
        ? T
        : [T] extends [(infer U)[]]
          ? NullsToUndefined<U>[]
          : T extends object
            ? { [K in keyof T]: NullsToUndefined<T[K]> }
            : T;

/**
 * Converts null and undefined values to undefined
 * @param obj
 * @returns
 */
export function nullsToUndefined<T>(obj: T): NullsToUndefined<T> {
  if (obj === null || obj === undefined) {
    return undefined as NullsToUndefined<T>;
  }

  if ((obj as object).constructor.name === "Object" || Array.isArray(obj)) {
    for (const key in obj) {
      obj[key] = nullsToUndefined(obj[key]) as (typeof obj)[typeof key];
    }
  }
  return obj as NullsToUndefined<T>;
}
