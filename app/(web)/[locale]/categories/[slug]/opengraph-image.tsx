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
export const alt = "Category OpenGraph image";
export const size = { width: 1200, height: 630 };

export default async function Image({ params }: PageProps) {
  const { slug, locale } = await params;
  const isVietnamese = locale === "vi";
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      name: true,
      nameVi: true,
      label: true,
      labelVi: true,
      description: true,
      descriptionVi: true,
      _count: {
        select: { tools: true },
      },
    },
  });

  if (!category) {
    notFound();
  }

  const englishName = category.label || `${category.name} Tools`;
  const localizedName = isVietnamese
    ? (category.labelVi ?? category.nameVi ?? category.label ?? category.name)
    : englishName;
  const description = isVietnamese
    ? (category.descriptionVi ?? category.description)
    : category.description;
  let toolsLabel = "Tools";
  if (isVietnamese) {
    toolsLabel = "công cụ";
  } else if (category._count.tools === 1) {
    toolsLabel = "Tool";
  }

  return new ImageResponse(
    <OgBase description={description} faviconUrl={null} name={localizedName}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8",
          padding: "0.5rem 1rem",
          border: "0.1em solid #3B82F6",
          borderRadius: "0.75rem",
          backgroundColor: "#EFF6FF",
          color: "#1D4ED8",
          fontSize: "1.6rem",
          fontFamily: "GeistBold",
        }}
      >
        <svg
          aria-label="Category"
          fill="none"
          height="24"
          role="img"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          style={{ height: "1.75rem", width: "1.75rem", marginRight: "4" }}
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect height="7" width="7" x="3" y="3" />
          <rect height="7" width="7" x="14" y="3" />
          <rect height="7" width="7" x="14" y="14" />
          <rect height="7" width="7" x="3" y="14" />
        </svg>
        {category._count.tools} {toolsLabel}
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
