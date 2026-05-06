import { dataTableConfig } from "~/config/data-table";
import { linksConfig } from "~/config/links";
import { mediaConfig } from "~/config/media";
import { siteConfig } from "~/config/site";
import { submissionsConfig } from "~/config/submissions";

/**
 * Server-side only config that includes environment variables
 * DO NOT import this in client components
 */
export const config = {
  site: siteConfig,
  media: mediaConfig,
  links: linksConfig,
  submissions: submissionsConfig,
  dataTable: dataTableConfig,
};
