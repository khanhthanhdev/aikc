const HTML_MEDIA_TYPE = "text/html";
export const MARKDOWN_MEDIA_TYPE = "text/markdown";
export const MARKDOWN_VARY_HEADER = "Accept, Accept-Encoding";

interface AcceptEntry {
  type: string;
  quality: number;
  specificity: number;
  position: number;
}

const parseAccept = (header: string): AcceptEntry[] =>
  header.split(",").map((raw, position) => {
    const [mediaRange, ...parameters] = raw
      .trim()
      .split(";")
      .map((part) => part.trim());
    const qualityParameter = parameters.find((parameter) =>
      parameter.startsWith("q=")
    );
    const parsedQuality = qualityParameter
      ? Number(qualityParameter.slice(2))
      : 1;
    const type = mediaRange.toLowerCase();

    return {
      type,
      quality: Number.isFinite(parsedQuality)
        ? Math.min(1, Math.max(0, parsedQuality))
        : 1,
      specificity: type === "*/*" ? 0 : type.endsWith("/*") ? 1 : 2,
      position,
    };
  });

const matches = (entry: AcceptEntry, candidate: string): boolean =>
  entry.type === "*/*" ||
  (entry.type.endsWith("/*") &&
    candidate.startsWith(entry.type.slice(0, -1))) ||
  entry.type === candidate;

/**
 * Select the representation using RFC 9110 quality and specificity rules.
 * `null` means that the client explicitly rejects every representation.
 */
export const preferredRepresentation = (
  acceptHeader: string | null
): typeof HTML_MEDIA_TYPE | typeof MARKDOWN_MEDIA_TYPE | null => {
  if (!acceptHeader) {
    return HTML_MEDIA_TYPE;
  }

  const entries = parseAccept(acceptHeader);
  if (entries.length === 0) {
    return HTML_MEDIA_TYPE;
  }

  let selected: {
    type: typeof HTML_MEDIA_TYPE | typeof MARKDOWN_MEDIA_TYPE;
    quality: number;
    position: number;
  } | null = null;

  for (const candidate of [HTML_MEDIA_TYPE, MARKDOWN_MEDIA_TYPE] as const) {
    let matchingEntry: AcceptEntry | null = null;
    for (const entry of entries) {
      if (
        matches(entry, candidate) &&
        (matchingEntry === null ||
          entry.specificity > matchingEntry.specificity ||
          (entry.specificity === matchingEntry.specificity &&
            entry.position < matchingEntry.position))
      ) {
        matchingEntry = entry;
      }
    }

    if (!matchingEntry || matchingEntry.quality === 0) {
      continue;
    }

    if (
      selected === null ||
      matchingEntry.quality > selected.quality ||
      (matchingEntry.quality === selected.quality &&
        matchingEntry.position < selected.position)
    ) {
      selected = {
        type: candidate,
        quality: matchingEntry.quality,
        position: matchingEntry.position,
      };
    }
  }

  return selected?.type ?? null;
};

export const appendMarkdownVary = (headers: Headers): void => {
  const values = (headers.get("Vary") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const requiredValue of MARKDOWN_VARY_HEADER.split(",")) {
    const trimmed = requiredValue.trim();
    if (!values.some((value) => value.toLowerCase() === trimmed.toLowerCase())) {
      values.push(trimmed);
    }
  }

  headers.set("Vary", values.join(", "));
};
