import { ImageResponse } from "next/og";
import { OgBase } from "~/components/web/og/og-base";
import { loadLocalFont } from "~/lib/og-fonts";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const contentType = "image/png";
export const alt = "Tool Categories";
export const size = { width: 1200, height: 630 };
export const runtime = "nodejs";

export default async function Image({ params }: PageProps) {
  const { locale } = await params;
  const isVietnamese = locale === "vi";

  return new ImageResponse(
    <OgBase
      description={
        isVietnamese
          ? "Khám phá tất cả danh mục công cụ"
          : "Browse all tool categories"
      }
      faviconUrl={null}
      name={isVietnamese ? "Danh mục" : "Categories"}
    />,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Geist",
          data: await loadLocalFont("GeistSans", 400),
          weight: 400,
          style: "normal",
        },
        {
          name: "GeistBold",
          data: await loadLocalFont("GeistSans", 600),
          weight: 600,
          style: "normal",
        },
      ],
    }
  );
}
