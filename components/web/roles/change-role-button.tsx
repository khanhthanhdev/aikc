"use client";

import { UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Button } from "~/components/web/ui/button";
import { useRole } from "./role-context";

/** Reopens the role popup. */
export const ChangeRoleButton = (props: ComponentProps<typeof Button>) => {
  const t = useTranslations("Roles");
  const { setDialogOpen } = useRole();

  return (
    <Button
      onClick={() => setDialogOpen(true)}
      prefix={<UserRoundIcon />}
      size="md"
      type="button"
      variant="secondary"
      {...props}
    >
      {t("change")}
    </Button>
  );
};
