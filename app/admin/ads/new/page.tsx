import type { Metadata } from "next";
import { AdForm } from "~/app/admin/ads/_components/form/ad-form";
import { Wrapper } from "~/components/admin/ui/wrapper";
import { H4 } from "~/components/common/heading";

export const metadata: Metadata = {
  title: "Create ad",
};

export default async function CreateAdPage() {
  return (
    <Wrapper size="md">
      <H4 as="h1">Create ad</H4>

      <AdForm />
    </Wrapper>
  );
}
