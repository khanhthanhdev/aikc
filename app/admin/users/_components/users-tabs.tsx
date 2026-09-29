import Link from "next/link";
import type { UsersTab } from "~/app/admin/users/_lib/validations";
import { cx } from "~/utils/cva";

const TABS = [
  { value: "admins", label: "Admins", href: "/admin/users" },
  {
    value: "submitters",
    label: "Tool submitters",
    href: "/admin/users?tab=submitters",
  },
] as const satisfies ReadonlyArray<{
  value: UsersTab;
  label: string;
  href: string;
}>;

export const UsersTabs = ({ active }: { active: UsersTab }) => (
  <nav aria-label="User lists" className="flex gap-6 border-b" role="tablist">
    {TABS.map(({ value, label, href }) => (
      <Link
        aria-selected={value === active}
        className={cx(
          "-mb-px border-b-2 pb-2 font-medium text-sm transition-colors",
          value === active
            ? "border-foreground text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
        href={href}
        key={value}
        role="tab"
      >
        {label}
      </Link>
    ))}
  </nav>
);
