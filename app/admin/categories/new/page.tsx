import type { Metadata } from "next";
import { CategoryForm } from "~/app/admin/categories/_components/category-form";
import { Wrapper } from "~/components/admin/ui/wrapper";
import { H4 } from "~/components/common/heading";

export const metadata: Metadata = {
  title: "Create category",
};

export default async function CreateCategoryPage() {
  return (
    <Wrapper size="md">
      <H4 as="h1">Create category</H4>

      <CategoryForm />
    </Wrapper>
  );
}
