import { ArrowRightIcon } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { H4 } from "~/components/common/heading";
import { ToolCard } from "~/components/web/cards/tool-card";
import { ChangeRoleButton } from "~/components/web/roles/change-role-button";
import { RoleIcon } from "~/components/web/roles/role-icon";
import { Button } from "~/components/web/ui/button";
import { Grid } from "~/components/web/ui/grid";
import { isUserRole, ROLE_COOKIE, type UserRole } from "~/config/roles";
import { Link } from "~/i18n/navigation";
import { findTools } from "~/server/tools/queries";

const PICKS = 6;

/**
 * Tools filed under a role, those the role suits best first: a tool lists its
 * roles best fit first, so one made for students beats one students can use.
 */
const getRoleTools = async (role: UserRole) => {
  "use cache";

  cacheLife("max");
  cacheTag("tools");

  const tools = await findTools({
    where: { roles: { has: role } },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: PICKS * 5,
  });

  return tools
    .map((tool, index) => ({ tool, index, rank: tool.roles.indexOf(role) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, PICKS)
    .map(({ tool }) => tool);
};

/** "Recommended for you": picks for the role the visitor chose in the popup. */
export const RoleTools = async ({ locale }: { locale: string }) => {
  const role = (await cookies()).get(ROLE_COOKIE)?.value;

  if (!isUserRole(role)) {
    return null;
  }

  const [tools, t] = await Promise.all([
    getRoleTools(role),
    getTranslations({ locale, namespace: "Roles" }),
  ]);

  if (!tools.length) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <H4 as="h2">{t("forYouTitle")}</H4>
          <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <RoleIcon className="size-4" role={role} />
            {t("forYouDescription", { role: t(`${role}.label`) })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ChangeRoleButton />
          <Button asChild size="md" suffix={<ArrowRightIcon />} variant="secondary">
            <Link href={`/?role=${role}`}>{t("viewAll")}</Link>
          </Button>
        </div>
      </div>

      <Grid>
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </Grid>
    </section>
  );
};
