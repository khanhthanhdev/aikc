import type { ComponentProps } from "react";
import { AdBannerDisplay } from "~/components/web/ads/ad-banner-display";
import type { Container } from "~/components/web/ui/container";
import { findAd } from "~/server/web/ads/queries";

export const AdBanner = async ({
  className,
  ...props
}: ComponentProps<typeof Container>) => {
  const ad = await findAd({ where: { type: "Banner" } });

  if (!ad) {
    return null;
  }

  return <AdBannerDisplay ad={ad} className={className} />;
};
