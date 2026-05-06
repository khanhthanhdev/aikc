import type { Metadata } from "next";
import { TagForm } from "~/app/admin/tags/_components/tag-form";
import { getTools } from "~/app/admin/tags/_lib/queries";
import { Wrapper } from "~/components/admin/ui/wrapper";
import { H4 } from "~/components/common/heading";

export const metadata: Metadata = {
  title: "Create tag",
};

export default async function CreateTagPage() {
  const tools = await getTools();

  return (
    <Wrapper size="md">
      <H4 as="h1">Create tag</H4>

      <TagForm tools={tools} />
    </Wrapper>
  );
}
