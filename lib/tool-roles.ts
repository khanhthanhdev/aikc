import type { Tool } from "@prisma/client";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import {
  isUserRole,
  MAX_TOOL_ROLES,
  QUESTIONS_PER_ROLE,
  type RoleQuestions,
  USER_ROLES,
  type UserRole,
  userRoles,
} from "~/config/roles";
import { logger } from "~/lib/logger";
import { cleanQuestions, parseRoleQuestions } from "~/lib/role-questions";
import {
  acquireBatchModel,
  googleNoThinkingProviderOptions,
} from "~/services/google";
import { prisma } from "~/services/prisma";

// No "server-only" here: scripts/assign-roles.ts runs this under plain bun.

const log = logger.ai;

/** Keeps the prompt small; the first part of the content says what the tool is. */
const MAX_CONTENT_LENGTH = 2000;

type RoleTool = Pick<
  Tool,
  "name" | "websiteUrl" | "tagline" | "description" | "content"
> & { categories?: { name: string }[] };

/**
 * The provider now and then cuts a reply off mid-way (OpenRouter reports
 * `finish_reason: "error"`), which the SDK does not retry. Such a call costs
 * nothing, so try again a couple of times before giving up.
 */
const GENERATE_ATTEMPTS = 3;

const withRetries = async <T>(generate: () => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await generate();
    } catch (error) {
      if (
        !NoObjectGeneratedError.isInstance(error) ||
        attempt >= GENERATE_ATTEMPTS
      ) {
        throw error;
      }
      log.warn(`Role suggestion cut off, retrying (${attempt})`, {
        finishReason: error.finishReason,
      });
    }
  }
};

/**
 * Yes/no questions ("Can X…?", "…không?") make poor chat starters; the model
 * still writes a few despite the prompt, so they are dropped from its output.
 */
const YES_NO = {
  en: /^(can|could|is|are|does|do|should|will|would)\b/i,
  vi: /(không|chưa)\s*\?$/i,
};

export type ToolRoleSuggestion = {
  /** Best fit first; possibly empty. */
  roles: UserRole[];
  roleQuestions: RoleQuestions;
};

/**
 * Ask the model which audience roles a tool suits, and write sample chat
 * questions each of those people would ask about it, in English and Vietnamese.
 *
 * The roles are constrained to the keys in config/roles.ts, so the model can
 * never invent one.
 *
 * @param roles Write questions for exactly these roles instead of picking them.
 */
export const suggestToolRoles = async (
  tool: RoleTool,
  { roles: fixedRoles }: { roles?: readonly UserRole[] } = {}
): Promise<ToolRoleSuggestion> => {
  const allowedRoles = (
    fixedRoles?.length ? fixedRoles : userRoles
  ) as typeof userRoles;

  const rolesRules = fixedRoles?.length
    ? `- The roles are already chosen: write one entry for each of ${fixedRoles.join(", ")}, and no other role.`
    : `
      - Pick the people who would seek this tool out for their work, not everyone who could use it. Most tools have 1 or 2; only general-purpose tools get ${MAX_TOOL_ROLES}.
      - A general assistant everyone can use still goes to the roles it is best known for.
      - Order them by who the tool is built for: its makers' target users come first. Don't default to students because the directory belongs to a university; a tool made for teachers, companies or developers leads with that role.
    `;

  const { object } = await withRetries(async () =>
    generateObject({
      model: await acquireBatchModel(),
      schema: z.object({
        roles: z
          .array(
            z.object({
              role: z.enum(allowedRoles),
              questions: z
                .array(z.string())
                .describe(`${QUESTIONS_PER_ROLE} questions in English`),
              questionsVi: z
                .array(z.string())
                .describe(`The same ${QUESTIONS_PER_ROLE} questions in Vietnamese`),
            })
          )
          .describe(
            fixedRoles?.length
              ? "One entry per given role."
              : `Roles the tool genuinely suits, best fit first. 1 to ${MAX_TOOL_ROLES}.`
          ),
      }),
      system: `
        You match Work & Study tools on a university library's directory to the people who would use them, and write the questions those people would ask an AI assistant about the tool.

        Roles:
        ${rolesRules}

        Questions, for each chosen role:
        - Exactly ${QUESTIONS_PER_ROLE}, written as that person typing to the assistant, e.g. "How can I use Anki to memorize anatomy terms?".
        - Specific to this tool and to real tasks of that role. They are shown a few at a time, so make each one different: getting started, concrete use cases, tips, limits, comparisons.
        - Short (max 14 words), keep the tool's name as is.
        - Open questions only (How, What, Which, Why...): never start with "Can", "Is", "Does" or "Should", and in Vietnamese never end with "không?" or "được không?".
        - Vietnamese versions must read naturally for Vietnamese users, not word-for-word translations.
      `,
      prompt: `
        Roles (key: who they are):
        ${allowedRoles.map((role) => `- ${role}: ${USER_ROLES[role].description}`).join("\n")}

        Tool:
        name: ${tool.name}
        website: ${tool.websiteUrl}
        categories: ${tool.categories?.map(({ name }) => name).join(", ") || "none"}
        tagline: ${tool.tagline ?? ""}
        description: ${tool.description ?? ""}
        content: ${(tool.content ?? "").slice(0, MAX_CONTENT_LENGTH)}
      `,
      temperature: 0.4,
      // A full answer (3 roles × 6 questions × 2 languages) is ~1,500 tokens;
      // the cap keeps a runaway reply cheap and stops OpenRouter from
      // reserving credits for the model's 65k maximum
      maxOutputTokens: 4000,
      experimental_telemetry: { isEnabled: true },
      providerOptions: googleNoThinkingProviderOptions,
    })
  );

  const roles: UserRole[] = [];
  const roleQuestions: RoleQuestions = {};

  for (const { role, questions, questionsVi } of object.roles) {
    if (
      roles.includes(role) ||
      (!fixedRoles?.length && roles.length >= MAX_TOOL_ROLES)
    ) {
      continue;
    }

    roles.push(role);

    const en = cleanQuestions(questions.filter((q) => !YES_NO.en.test(q)));
    const vi = cleanQuestions(questionsVi.filter((q) => !YES_NO.vi.test(q)));
    if (en.length || vi.length) {
      roleQuestions[role] = { en, vi };
    }
  }

  return { roles, roleQuestions };
};

export type AutoAssignRolesResult =
  /** The tool already had roles and questions for all of them; nothing changed. */
  | { status: "skipped"; roles: [] }
  /** The tool kept its roles; questions were written for the roles lacking them. */
  | { status: "filled"; roles: UserRole[] }
  /** The model found no fitting role. */
  | { status: "none"; roles: [] }
  | { status: "assigned"; roles: UserRole[] };

/** What the model needs to know about a tool, plus its current roles. */
const roleToolSelect = {
  slug: true,
  name: true,
  websiteUrl: true,
  tagline: true,
  description: true,
  content: true,
  roles: true,
  roleQuestions: true,
  categories: { select: { name: true } },
} as const;

/**
 * Give a tool its roles and sample questions. A tool that already has roles
 * (unless `force`) keeps them, and only gets questions for the roles that have
 * none — so what an admin set is never overwritten.
 *
 * Run it after categories are assigned: the model uses them as a hint.
 */
export const autoAssignToolRoles = async (
  toolId: string,
  { force = false }: { force?: boolean } = {}
): Promise<AutoAssignRolesResult> => {
  const tool = await prisma.tool.findUniqueOrThrow({
    where: { id: toolId },
    select: roleToolSelect,
  });

  if (tool.roles.length && !force) {
    const { filled } = await fillMissingRoleQuestions(toolId);
    log.info(`Roles kept for ${tool.slug}: already assigned`, { filled });
    return filled.length
      ? { status: "filled", roles: filled }
      : { status: "skipped", roles: [] };
  }

  const { roles, roleQuestions } = await suggestToolRoles(tool);

  if (!roles.length) {
    log.info(`No fitting role for ${tool.slug}`);
    return { status: "none", roles: [] };
  }

  await prisma.tool.update({
    where: { id: toolId },
    data: { roles, roleQuestions },
  });

  log.info(`Roles assigned to ${tool.slug}`, { roles });
  return { status: "assigned", roles };
};

/**
 * Write sample questions for the tool's roles that have none yet, in either
 * language — e.g. roles an admin picked without generating questions. Questions
 * that exist are kept as they are.
 *
 * Tools not processed yet (no tagline, description or content) are left
 * alone: the pipeline fills them in once their content is scraped.
 *
 * @returns The roles that got questions, and the tool's questions after that.
 */
export const fillMissingRoleQuestions = async (
  toolId: string
): Promise<{ filled: UserRole[]; roleQuestions: RoleQuestions }> => {
  const tool = await prisma.tool.findUniqueOrThrow({
    where: { id: toolId },
    select: roleToolSelect,
  });

  const roles = tool.roles.filter(isUserRole);
  const current = parseRoleQuestions(tool.roleQuestions, roles);
  const missing = roles.filter(
    (role) => !(current[role]?.en.length && current[role]?.vi.length)
  );

  if (!missing.length || !(tool.tagline || tool.description || tool.content)) {
    return { filled: [], roleQuestions: current };
  }

  const { roleQuestions: written } = await suggestToolRoles(tool, {
    roles: missing,
  });

  const merged: RoleQuestions = { ...current };
  const filled: UserRole[] = [];

  for (const role of missing) {
    const questions = written[role];
    if (!questions) {
      continue;
    }

    merged[role] = {
      en: current[role]?.en.length ? current[role].en : questions.en,
      vi: current[role]?.vi.length ? current[role].vi : questions.vi,
    };
    filled.push(role);
  }

  if (filled.length) {
    await prisma.tool.update({
      where: { id: toolId },
      data: { roleQuestions: merged },
    });
  }

  return { filled, roleQuestions: merged };
};
