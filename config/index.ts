import { adsConfig } from "~/config/ads";
import { dataTableConfig } from "~/config/data-table";
import { linksConfig } from "~/config/links";
import { mediaConfig } from "~/config/media";
import { siteConfig } from "~/config/site";

/**
 * Client-safe config that only includes public environment variables
 * Safe to import in both server and client components
 */
export const config = {
  site: siteConfig,
  media: mediaConfig,
  links: linksConfig,
  dataTable: dataTableConfig,
  ads: adsConfig,
};
