import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { OgBase } from "~/components/web/og/og-base";
import { loadLocalFont } from "~/lib/og-fonts";
import { prisma } from "~/services/prisma";

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
}

// Image metadata
export const contentType = "image/png";
export const alt = "Tag OpenGraph image";
export const size = { width: 1200, height: 630 };

export default async function Image({ params }: PageProps) {
  const { slug, locale } = await params;
  const isVietnamese = locale === "vi";
  const tag = await prisma.tag.findUnique({
    where: { slug },
    select: {
      name: true,
      nameVi: true,
      _count: {
        select: { tools: true },
      },
    },
  });

  if (!tag) {
    notFound();
  }

  const tagName = isVietnamese ? (tag.nameVi ?? tag.name) : tag.name;
  const toolsLabel = isVietnamese
    ? "công cụ học tập và làm việc"
    : "Work & Study Tools";

  return new ImageResponse(
    <OgBase
      description={`${tag._count.tools} ${toolsLabel}`}
      faviconUrl={null}
      name={`#${tagName}`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0.5rem 1rem",
          border: "0.1em solid #10B981",
          borderRadius: "0.75rem",
          backgroundColor: "#ECFDF5",
          color: "#047857",
          fontSize: "1.6rem",
          fontFamily: "GeistBold",
        }}
      >
        <svg
          aria-label="Tag"
          fill="none"
          height="24"
          role="img"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          style={{ height: "1.75rem", width: "1.75rem", marginRight: 4 }}
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <path d="M7 7h.01" />
        </svg>
        {tag._count.tools} {isVietnamese ? "công cụ" : "Tools"}
      </div>
    </OgBase>,
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
