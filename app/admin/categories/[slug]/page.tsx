import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryActions } from "~/app/admin/categories/_components/category-actions";
import { CategoryForm } from "~/app/admin/categories/_components/category-form";
import { getCategoryBySlug } from "~/app/admin/categories/_lib/queries";
import { Wrapper } from "~/components/admin/ui/wrapper";
import { H4 } from "~/components/common/heading";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Update category",
};

export default async function UpdateCategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return notFound();
  }

  return (
    <Wrapper size="md">
      <div className="flex items-center justify-between gap-4">
        <H4 as="h1">Update category</H4>

        <CategoryActions category={category} />
      </div>

      <CategoryForm category={category} />
    </Wrapper>
  );
}
