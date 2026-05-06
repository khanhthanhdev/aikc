import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdActions } from "~/app/admin/ads/_components/actions/ad-actions";
import { AdForm } from "~/app/admin/ads/_components/form/ad-form";
import { getAdById } from "~/app/admin/ads/_lib/queries";
import { Wrapper } from "~/components/admin/ui/wrapper";
import { H4 } from "~/components/common/heading";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Update ad",
};

export default async function UpdateAdPage({ params }: PageProps) {
  const { id } = await params;

  const ad = await getAdById(id);

  if (!ad) {
    return notFound();
  }

  return (
    <Wrapper size="md">
      <div className="flex items-center justify-between gap-4">
        <H4 as="h1">Update ad</H4>

        <AdActions ad={ad} />
      </div>

      <AdForm ad={ad} />
    </Wrapper>
  );
}
