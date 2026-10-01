import Script from "next/script";
import { config } from "~/config";
import { env } from "~/env";
import { UMAMI_PROXY_PATH } from "~/lib/analytics";

/**
 * Umami tracker for the public site. The admin area has its own layout and is
 * not counted.
 *
 * `data-domains` limits counting to the configured site host, so a local or
 * preview build that shares the website ID does not mix its visits in.
 */
export const Analytics = () => {
  const websiteId = env.UMAMI_WEBSITE_ID;

  if (!websiteId) {
    return null;
  }

  return (
    <Script
      data-domains={new URL(config.site.url).hostname}
      data-website-id={websiteId}
      src={`${UMAMI_PROXY_PATH}/script.js`}
      strategy="afterInteractive"
    />
  );
};
