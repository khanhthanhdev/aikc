import {
  BriefcaseIcon,
  Building2Icon,
  ChartColumnIcon,
  ClapperboardIcon,
  CodeXmlIcon,
  GraduationCapIcon,
  HeadsetIcon,
  HeartPulseIcon,
  type LucideIcon,
  type LucideProps,
  MicroscopeIcon,
  PaletteIcon,
  PresentationIcon,
} from "lucide-react";
import type { UserRole } from "~/config/roles";

const ROLE_ICONS: Record<UserRole, LucideIcon> = {
  student: GraduationCapIcon,
  lecturer: PresentationIcon,
  researcher: MicroscopeIcon,
  developer: CodeXmlIcon,
  "data-analyst": ChartColumnIcon,
  designer: PaletteIcon,
  "content-creator": ClapperboardIcon,
  business: BriefcaseIcon,
  "customer-support": HeadsetIcon,
  healthcare: HeartPulseIcon,
  office: Building2Icon,
};

export const RoleIcon = ({ role, ...props }: LucideProps & { role: UserRole }) => {
  const Icon = ROLE_ICONS[role];
  return <Icon {...props} />;
};
