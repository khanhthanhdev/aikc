/**
 * Audience roles a visitor can pick on their first visit.
 *
 * They mirror the site's categories: each role is the kind of person the
 * categories serve, so every tool fits at least one. Labels and sample
 * questions live in the `Roles` messages; the descriptions below only brief the
 * model that files tools under roles (lib/tool-roles.ts).
 *
 * Keys are stored on tools (`Tool.roles`) and in the visitor's cookie, so
 * rename one only together with a data migration.
 */
export const USER_ROLES = {
  student: {
    description:
      "University or school students: studying, note-taking, assignments, essays, exam prep, flashcards, learning languages.",
  },
  lecturer: {
    description:
      "Teachers and lecturers: lesson planning, slides, quizzes and exercises, grading, explaining concepts, classroom engagement.",
  },
  researcher: {
    description:
      "Academic researchers and postgraduates: literature search, reading papers, citations, academic writing, research data.",
  },
  developer: {
    description:
      "Software developers: writing and debugging code, code review, APIs, documentation, building apps.",
  },
  "data-analyst": {
    description:
      "Data analysts: spreadsheets, SQL, statistics, dashboards, charts and reports from data.",
  },
  designer: {
    description:
      "Designers: UI/UX, graphics, branding, image generation, prototyping, creative projects.",
  },
  "content-creator": {
    description:
      "Content creators and marketers: writing posts, video, audio, podcasts, social media, SEO, campaigns.",
  },
  business: {
    description:
      "Business owners and managers: CRM, sales, planning, finance, reporting, running a team.",
  },
  "customer-support": {
    description:
      "Customer support and service staff: helpdesk, chatbots, answering customers, support knowledge bases.",
  },
  healthcare: {
    description:
      "Healthcare and wellness: medical and nursing students or professionals, fitness, mental health, wellbeing.",
  },
  office: {
    description:
      "Office and administrative staff: email, documents, scheduling, meetings, translation, everyday productivity.",
  },
} as const satisfies Record<string, { description: string }>;

export type UserRole = keyof typeof USER_ROLES;

export const userRoles = Object.keys(USER_ROLES) as [UserRole, ...UserRole[]];

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && Object.hasOwn(USER_ROLES, value);

/** Admin-facing label: `data-analyst` → `Data analyst` */
export const formatRole = (role: UserRole) => {
  const words = role.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Cookie that remembers the visitor's pick, so the role popup is shown once.
 * Holds a role key, or `ROLE_SKIPPED` when they chose not to say.
 */
export const ROLE_COOKIE = "aikc-role";
export const ROLE_SKIPPED = "none";
export const ROLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Sample chat questions per role for one tool, as stored in `Tool.roleQuestions`. */
export type RoleQuestions = Partial<
  Record<UserRole, { en: string[]; vi: string[] }>
>;

/**
 * How many sample questions a tool keeps per role and language. The chat shows
 * `SUGGESTED_QUESTIONS` of them, picked anew each time it opens.
 */
export const QUESTIONS_PER_ROLE = 6;

/** How many sample questions the chat shows at once. */
export const SUGGESTED_QUESTIONS = 3;

/** A tool is filed under at most this many roles, best fit first. */
export const MAX_TOOL_ROLES = 3;
