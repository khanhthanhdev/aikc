"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/web/ui/dialog";
import { userRoles } from "~/config/roles";
import { usePathname } from "~/i18n/navigation";
import { cx } from "~/utils/cva";
import { useRole } from "./role-context";
import { RoleIcon } from "./role-icon";

/** Pages where asking for a role would get in the way. */
const QUIET_PATHS = ["/login"];

/**
 * Asks first-time visitors what they do. Dismissing it counts as skipping,
 * so it never comes back on its own; "Change role" buttons reopen it.
 */
export function RoleDialog() {
  const t = useTranslations("Roles");
  const pathname = usePathname();
  const { role, hasChosen, isDialogOpen, setDialogOpen, setRole } = useRole();

  if (QUIET_PATHS.includes(pathname) && !hasChosen) {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setDialogOpen(true);
    } else if (hasChosen) {
      setDialogOpen(false);
    } else {
      setRole(null);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={isDialogOpen}>
      <DialogContent className="top-1/2 max-h-[90dvh] max-w-2xl -translate-y-1/2 overflow-y-auto data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {userRoles.map((key) => (
            <button
              aria-pressed={role === key}
              className={cx(
                "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors hover:bg-foreground/5",
                role === key
                  ? "border-foreground/50 bg-foreground/5"
                  : "border-foreground/15"
              )}
              key={key}
              onClick={() => setRole(key)}
              type="button"
            >
              <RoleIcon
                className="mt-0.5 size-4 shrink-0 text-foreground/60"
                role={key}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-display font-semibold text-sm">
                  {t(`${key}.label`)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t(`${key}.hint`)}
                </span>
              </span>
            </button>
          ))}
        </div>

        {!hasChosen && (
          <button
            className="justify-self-center text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => setRole(null)}
            type="button"
          >
            {t("skip")}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
