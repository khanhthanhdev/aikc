/**
 * Get localized field value based on locale
 * Falls back to English if Vietnamese translation is missing
 */
export function getLocalizedField<
  T extends Record<string, string | null | undefined>,
>(entity: T, field: keyof T, locale: string): string | null | undefined {
  const isVietnamese = locale === "vi";

  if (!isVietnamese) {
    return entity[field] as string | null | undefined;
  }

  const viField = `${String(field)}Vi` as keyof T;
  const vietnameseValue = entity[viField];

  // Return Vietnamese if available, fallback to English
  return (vietnameseValue ?? entity[field]) as string | null | undefined;
}

/**
 * Helper to get localized tool fields
 */
export function getLocalizedTool(
  tool: Record<string, unknown>,
  locale: string
) {
  const isVietnamese = locale === "vi";

  if (!isVietnamese) {
    return tool;
  }

  return {
    ...tool,
    name: tool.nameVi ?? tool.name,
    tagline: tool.taglineVi ?? tool.tagline,
    description: tool.descriptionVi ?? tool.description,
    summary: tool.summaryVi ?? tool.summary,
    content: tool.contentVi ?? tool.content,
    pricing: tool.pricingVi ?? tool.pricing,
  };
}

/**
 * Helper to get localized category fields
 */
export function getLocalizedCategory(
  category: Record<string, unknown>,
  locale: string
) {
  const isVietnamese = locale === "vi";

  if (!isVietnamese) {
    return category;
  }

  return {
    ...category,
    name: category.nameVi ?? category.name,
    label: category.labelVi ?? category.label,
    description: category.descriptionVi ?? category.description,
  };
}

/**
 * Helper to get localized collection fields
 */
export function getLocalizedCollection(
  collection: Record<string, unknown>,
  locale: string
) {
  const isVietnamese = locale === "vi";

  if (!isVietnamese) {
    return collection;
  }

  return {
    ...collection,
    name: collection.nameVi ?? collection.name,
    description: collection.descriptionVi ?? collection.description,
  };
}

/**
 * Helper to get localized tag fields
 */
export function getLocalizedTag(tag: Record<string, unknown>, locale: string) {
  const isVietnamese = locale === "vi";

  if (!isVietnamese) {
    return tag;
  }

  return {
    ...tag,
    name: tag.nameVi ?? tag.name,
  };
}
