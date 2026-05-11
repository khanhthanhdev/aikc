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
export const alt = "Collection OpenGraph image";
export const size = { width: 1200, height: 630 };

export default async function Image({ params }: PageProps) {
  const { slug, locale } = await params;
  const isVietnamese = locale === "vi";
  const collection = await prisma.collection.findUnique({
    where: { slug },
    select: {
      name: true,
      nameVi: true,
      description: true,
      descriptionVi: true,
      _count: {
        select: { tools: true },
      },
    },
  });

  if (!collection) {
    notFound();
  }

  const name = isVietnamese
    ? (collection.nameVi ?? collection.name)
    : collection.name;
  const description = isVietnamese
    ? (collection.descriptionVi ?? collection.description)
    : collection.description;
  let toolsLabel = "Tools";
  if (isVietnamese) {
    toolsLabel = "công cụ";
  } else if (collection._count.tools === 1) {
    toolsLabel = "Tool";
  }

  return new ImageResponse(
    <OgBase description={description} faviconUrl={null} name={name}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "0.5rem 1rem",
          border: "0.1em solid #8B5CF6",
          borderRadius: "0.75rem",
          backgroundColor: "#F5F3FF",
          color: "#6D28D9",
          fontSize: "1.6rem",
          fontFamily: "GeistBold",
        }}
      >
        <svg
          aria-label="Collection"
          fill="none"
          height="24"
          role="img"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          style={{ height: "1.75rem", width: "1.75rem", marginRight: "4px" }}
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        </svg>
        {collection._count.tools} {toolsLabel}
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
