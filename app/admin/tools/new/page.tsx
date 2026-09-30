import type { Metadata } from "next";
import { ToolForm } from "~/app/admin/tools/_components/tool-form";
import { getCategories, getTags } from "~/app/admin/tools/_lib/queries";
import { Wrapper } from "~/components/admin/ui/wrapper";
import { H4 } from "~/components/common/heading";

export const metadata: Metadata = {
  title: "Create tool",
};

export default async function CreateToolPage() {
  const [categories, tags] = await Promise.all([getCategories(), getTags()]);

  return (
    <Wrapper size="md">
      <H4 as="h1">Create tool</H4>

      <ToolForm categories={categories} tags={tags} />
    </Wrapper>
  );
}
