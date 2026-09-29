import { z } from "zod";
import {
  QUESTIONS_PER_ROLE,
  type RoleQuestions,
  SUGGESTED_QUESTIONS,
  type UserRole,
  userRoles,
} from "~/config/roles";

/** Longest sample question kept; they are one-line chat prompts. */
const MAX_QUESTION_LENGTH = 200;

export const roleQuestionsSchema = z.partialRecord(
  z.enum(userRoles),
  z.object({
    en: z.array(z.string()),
    vi: z.array(z.string()),
  })
);

/** Trimmed, non-empty, unique questions, at most `QUESTIONS_PER_ROLE`. */
export const cleanQuestions = (questions: readonly string[]) =>
  [
    ...new Set(
      questions
        .map((question) => question.trim().slice(0, MAX_QUESTION_LENGTH))
        .filter(Boolean)
    ),
  ].slice(0, QUESTIONS_PER_ROLE);

/**
 * Pick `SUGGESTED_QUESTIONS` questions from a pool, shuffled by `seed`.
 *
 * The same seed always gives the same pick, so a render on the server and on
 * the client agree; seed 0 keeps the pool's order.
 */
export const pickQuestions = (pool: readonly string[], seed: number) => {
  const questions = [...pool];

  if (seed) {
    // mulberry32: a tiny seeded PRNG, enough to shuffle a handful of items
    let state = seed >>> 0;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };

    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
  }

  return questions.slice(0, SUGGESTED_QUESTIONS);
};

/**
 * Read `Tool.roleQuestions` (or form input) into a clean map.
 *
 * Unknown roles and malformed entries are dropped rather than failing: the
 * column is JSON, so a bad row must not break the tool page.
 *
 * @param roles When given, only questions for these roles are kept.
 */
export const parseRoleQuestions = (
  value: unknown,
  roles?: readonly string[]
): RoleQuestions => {
  const parsed = roleQuestionsSchema.safeParse(value ?? {});
  if (!parsed.success) {
    return {};
  }

  const result: RoleQuestions = {};

  for (const [role, questions] of Object.entries(parsed.data) as [
    UserRole,
    { en: string[]; vi: string[] },
  ][]) {
    if (roles && !roles.includes(role)) {
      continue;
    }

    const en = cleanQuestions(questions.en);
    const vi = cleanQuestions(questions.vi);

    if (en.length || vi.length) {
      result[role] = { en, vi };
    }
  }

  return result;
};
