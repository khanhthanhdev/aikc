import "server-only";
import wretch from "wretch";
import { isDev } from "~/env";

export type Socials = Record<
  string,
  Array<Record<string, string> & { url: string }>
>;

export const getSocialsFromUrl = async (url: string) => {
  try {
    const apiEndpoint = `https://brandlink.piotr-f64.workers.dev/api/links?url=${url}`;
    return await wretch(apiEndpoint).get().json<Socials>();
  } catch (error) {
    if (isDev) {
      console.error("Error fetching socials:", error);
    }
    return {};
  }
};
