import type { PropsWithChildren } from "react";
import { NorthernLights } from "~/components/common/northern-lights";

export default function SubmitLayout({ children }: PropsWithChildren) {
  return (
    <>
      <NorthernLights />
      {children}
    </>
  );
}
