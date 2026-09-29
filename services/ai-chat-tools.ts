import { tool } from "ai";
import { z } from "zod";

export interface YoutubeVideo {
  channelName?: string;
  thumbnailUrl: string;
  title: string;
  url: string;
  videoId: string;
}

/** A slow YouTube page must not hold the whole answer hostage. */
const YOUTUBE_SEARCH_TIMEOUT_MS = 4000;
const MAX_VIDEOS = 3;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const searchYoutubeSchema = z.object({
  query: z
    .string()
    .describe(
      "Search query for YouTube videos (e.g., 'Notion tutorial for beginners')"
    ),
});

/**
 * Tool for searching and displaying YouTube video cards in the chat UI.
 * Uses YouTube's internal search to find real videos.
 */
export const searchYoutubeVideos = tool({
  description:
    "Search YouTube for tutorial or how-to videos and display them to the user. Only use it when the user asks how to use a tool, for a tutorial or guide, or for videos — never for pricing, comparisons or tool recommendations. Provide an English search query describing the video topic.",
  inputSchema: searchYoutubeSchema,
  execute: async ({ query }) => {
    try {
      // Use YouTube's internal API (no API key needed, but rate limited)
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        signal: AbortSignal.timeout(YOUTUBE_SEARCH_TIMEOUT_MS),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        return [];
      }

      const html = await response.text();

      // Extract video data from the initial data JSON embedded in the page
      const ytInitialDataMatch = html.match(
        /var ytInitialData = ({.+?});<\/script>/
      );
      if (!ytInitialDataMatch) {
        return [];
      }

      const ytData = JSON.parse(ytInitialDataMatch[1]);
      const contents =
        ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents
          ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

      if (!contents) {
        return [];
      }

      const videos: YoutubeVideo[] = [];
      for (const item of contents) {
        if (videos.length >= MAX_VIDEOS) {
          break;
        }

        // Only plain videos: shorts, channels, playlists and ads use other renderers
        const videoRenderer = item.videoRenderer;
        if (!videoRenderer) {
          continue;
        }

        const videoId = videoRenderer.videoId;
        const title = videoRenderer.title?.runs?.[0]?.text;
        const channelName = videoRenderer.ownerText?.runs?.[0]?.text;

        if (
          typeof videoId === "string" &&
          YOUTUBE_VIDEO_ID.test(videoId) &&
          title
        ) {
          videos.push({
            videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title,
            channelName,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          });
        }
      }

      return videos;
    } catch (error) {
      // Includes the timeout; the answer text still goes out without videos
      console.warn(
        "[chat] YouTube search failed:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  },
});
