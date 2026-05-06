import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionActions } from "~/app/admin/collections/_components/collection-actions";
import { CollectionForm } from "~/app/admin/collections/_components/collection-form";
import { getCollectionBySlug } from "~/app/admin/collections/_lib/queries";
import { Wrapper } from "~/components/admin/ui/wrapper";
import { H4 } from "~/components/common/heading";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Update collection",
};

export default async function UpdateCollectionPage({ params }: PageProps) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    return notFound();
  }

  return (
    <Wrapper size="md">
      <div className="flex items-center justify-between gap-4">
        <H4 as="h1">Update collection</H4>

        <CollectionActions collection={collection} />
      </div>

      <CollectionForm collection={collection} />
    </Wrapper>
  );
}
