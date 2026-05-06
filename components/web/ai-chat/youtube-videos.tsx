"use client";

import { PlayIcon } from "lucide-react";

export interface YoutubeVideo {
  channelName?: string;
  thumbnailUrl: string;
  title: string;
  url: string;
  videoId: string;
}

interface YoutubeVideosProps {
  videos: YoutubeVideo[];
}

export function YoutubeVideos({ videos }: YoutubeVideosProps) {
  if (!videos.length) {
    return null;
  }

  const handleVideoClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <span className="font-medium text-muted-foreground text-xs">
        Related Videos
      </span>
      <div className="grid gap-2">
        {videos.map((video) => (
          <button
            className="group flex gap-2 rounded-lg border border-border bg-background p-2 text-left transition-all hover:border-foreground/20 hover:bg-foreground/5 sm:gap-3"
            key={video.videoId}
            onClick={(e) => handleVideoClick(e, video.url)}
            type="button"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video w-20 flex-shrink-0 overflow-hidden rounded-md bg-foreground/10 sm:w-28">
              <img
                alt={video.title}
                className="size-full object-cover"
                loading="lazy"
                src={video.thumbnailUrl}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                <PlayIcon className="size-6 text-white" fill="white" />
              </div>
            </div>

            {/* Info */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <span className="line-clamp-2 font-medium text-foreground text-sm leading-tight">
                {video.title}
              </span>
              {video.channelName && (
                <span className="truncate text-muted-foreground text-xs">
                  {video.channelName}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function YoutubeVideosLoading() {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <span className="font-medium text-muted-foreground text-xs">
        Loading videos...
      </span>
      <div className="grid gap-2">
        {[1, 2].map((i) => (
          <div
            className="flex animate-pulse gap-2 rounded-lg border border-border bg-background p-2 sm:gap-3"
            key={i}
          >
            <div className="aspect-video w-20 flex-shrink-0 rounded-md bg-foreground/10 sm:w-28" />
            <div className="flex flex-1 flex-col justify-center gap-1">
              <div className="h-4 w-3/4 rounded bg-foreground/10" />
              <div className="h-3 w-1/2 rounded bg-foreground/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
