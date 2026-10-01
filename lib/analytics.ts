/**
 * Custom events for Umami, the self-hosted analytics behind `/_proxy/umami`.
 *
 * Pageviews are counted by the tracker on its own; these are the actions
 * worth counting on top. Calls are no-ops until the tracker has loaded, and
 * always when it is not configured or a blocker removed it.
 */

/** Same-origin path the tracker script and its event endpoint live under. */
export const UMAMI_PROXY_PATH = "/_proxy/umami";

export type AnalyticsEventData = Record<string, string | number | boolean>;

type Umami = {
  track: (event: string, data?: AnalyticsEventData) => void;
};

declare global {
  interface Window {
    umami?: Umami;
  }
}

export const trackEvent = (event: string, data?: AnalyticsEventData) => {
  try {
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the page
  }
};
