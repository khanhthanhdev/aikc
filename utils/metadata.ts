import merge from "deepmerge";
import type { Metadata } from "next";
import { config } from "~/config";

export type ParseMetadataInput = Omit<Metadata, "keywords"> & {
  keywords?: string[] | string | null;
  noindex?: boolean;
};

export const parseMetadata = ({
  title: metaTitle = config.site.tagline,
  description = config.site.description,
  keywords = config.site.keywords,
  noindex = false,
  ...metadata
}: ParseMetadataInput): Metadata => {
  const title = metaTitle;
  const ogImages = metadata.openGraph?.images ?? [
    {
      url: `${config.site.url}/opengraph.png`,
      width: 1200,
      height: 630,
    },
  ];

  const customMetadata: Metadata = {
    title,
    description,
    keywords: Array.isArray(keywords) ? keywords.join(", ") : keywords,
    openGraph: {
      siteName: config.site.name,
      locale: "en_US",
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: title || undefined,
      description: description || undefined,
      images: ogImages,
    },
    alternates: {},
    robots: {
      index: !noindex,
      follow: !noindex,
      googleBot: {
        index: !noindex,
        follow: !noindex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };

  return merge(customMetadata, metadata, {
    arrayMerge: (_, sourceArray) => sourceArray,
  });
};
