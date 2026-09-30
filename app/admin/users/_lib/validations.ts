import * as z from "zod";

export const searchParamsSchema = z.object({
  page: z.coerce.number().default(1),
  per_page: z.coerce.number().default(50),
  sort: z.string().optional(),
  email: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  operator: z.enum(["and", "or"]).optional(),
  // Unknown values fall back to the admins list instead of a 500
  tab: z.enum(["admins", "submitters"]).catch("admins"),
});

export type UsersTab = z.infer<typeof searchParamsSchema>["tab"];

export const getUsersSchema = searchParamsSchema;

export type GetUsersSchema = z.infer<typeof getUsersSchema>;

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  name: z.string().trim().optional(),
});

export type InviteUserSchema = z.infer<typeof inviteUserSchema>;
