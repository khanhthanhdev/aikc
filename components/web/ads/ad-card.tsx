import type { AdType } from "@prisma/client";
import {
  AdCardDisplay,
  AdCardSkeleton,
} from "~/components/web/ads/ad-card-display";
import type { CardProps } from "~/components/web/ui/card";
import { config } from "~/config";
import { findAds } from "~/server/web/ads/queries";

type AdCardProps = CardProps & {
  rel?: string;
  type: AdType;
};

const AdCard = async ({ className, type, ...props }: AdCardProps) => {
  const ads = await findAds({ where: { type } });
  const displayAds = ads.length > 0 ? ads : [config.ads.defaultAd];

  return (
    <div className="flex flex-col gap-6">
      {displayAds.map((ad, i) => (
        <AdCardDisplay
          ad={ad}
          className={className}
          key={"id" in ad ? ad.id : `default-${i}`}
          {...props}
        />
      ))}
    </div>
  );
};

export { AdCard, AdCardDisplay, AdCardSkeleton };
