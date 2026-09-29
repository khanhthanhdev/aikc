import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolActions } from "~/app/admin/tools/_components/tool-actions";
import { ToolForm } from "~/app/admin/tools/_components/tool-form";
import {
  getCategories,
  getTags,
  getToolBySlug,
} from "~/app/admin/tools/_lib/queries";
import { Wrapper } from "~/components/admin/ui/wrapper";
import { H4 } from "~/components/common/heading";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Update tool",
};

export default async function UpdateToolPage({ params }: PageProps) {
  const { slug } = await params;

  const [tool, categories, tags] = await Promise.all([
    getToolBySlug(slug),
    getCategories(),
    getTags(),
  ]);

  if (!tool) {
    return notFound();
  }

  return (
    <Wrapper size="md">
      <div className="flex items-center justify-between gap-4">
        <H4 as="h1">Update tool</H4>

        <ToolActions tool={tool} />
      </div>

      <ToolForm categories={categories} tags={tags} tool={tool} />
    </Wrapper>
  );
}
