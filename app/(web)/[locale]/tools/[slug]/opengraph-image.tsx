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
export const alt = "Tool OpenGraph image";
export const size = { width: 1200, height: 630 };

export default async function Image({ params }: PageProps) {
  const { slug, locale } = await params;
  const isVietnamese = locale === "vi";

  const tool = await prisma.tool.findUnique({
    where: { slug },
    select: {
      name: true,
      nameVi: true,
      description: true,
      descriptionVi: true,
      faviconUrl: true,
      pricing: true,
      pricingVi: true,
    },
  });

  if (!tool) {
    notFound();
  }

  const name = isVietnamese ? (tool.nameVi ?? tool.name) : tool.name;
  const description = isVietnamese
    ? (tool.descriptionVi ?? tool.description)
    : tool.description;
  const pricing = isVietnamese
    ? (tool.pricingVi ?? tool.pricing)
    : tool.pricing;

  return new ImageResponse(
    <OgBase description={description} faviconUrl={tool.faviconUrl} name={name}>
      {pricing && (
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
            aria-label="Pricing"
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
            <line x1="12" x2="12" y1="1" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          {pricing}
        </div>
      )}
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
