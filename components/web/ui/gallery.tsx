"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import type { HTMLAttributes } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/web/ui/carousel";
import { cva, cx } from "~/utils/cva";

type GalleryImage =
  | string
  | {
      url: string;
      alt: string;
    };

type GalleryProps = HTMLAttributes<HTMLElement> & {
  images: GalleryImage[];
  priority?: boolean;
};

const galleryImageVariants = cva({
  base: "aspect-video rounded border border-foreground/10 bg-foreground/10 object-cover md:rounded-lg",
});

export const Gallery = ({ images, priority, ...props }: GalleryProps) => {
  const pathname = usePathname();

  if (images.length === 0) {
    return null;
  }

  if (images.length === 1) {
    if (!images[0]) {
      return <div className={cx(galleryImageVariants())} />;
    }

    return (
      <Image
        alt={typeof images[0] === "string" ? "" : images[0].alt}
        className={cx(galleryImageVariants({ className: "h-auto w-full" }))}
        height={720}
        key={pathname}
        priority={priority}
        src={typeof images[0] === "string" ? images[0] : images[0].url}
        width={1280}
      />
    );
  }

  return (
    <Carousel
      className="left-1/2 w-dvw -translate-x-1/2 overflow-x-clip"
      key={pathname}
      opts={{ align: "center", loop: true }}
      {...props}
    >
      <div className="relative">
        <CarouselContent>
          {images.map((image, index) => (
            <CarouselItem className="basis-4/5 md:basis-[656px]" key={index}>
              <Image
                alt={typeof image === "string" ? "" : image.alt}
                className={cx(galleryImageVariants({ className: "w-auto" }))}
                height={630}
                priority={index === 0 && priority}
                src={typeof image === "string" ? image : image.url}
                width={1200}
              />
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious />
        <CarouselNext />
      </div>

      <CarouselDots className="mt-6" />
    </Carousel>
  );
};
