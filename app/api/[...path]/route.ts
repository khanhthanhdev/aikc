import { apiErrorResponse } from "~/lib/api-error";

export function GET(): Response {
  return apiErrorResponse({
    status: 404,
    code: "NOT_FOUND",
    message: "The requested API endpoint does not exist.",
    hint: "Use /openapi.json to find supported API paths and methods.",
  });
}

const methodNotAllowed = (): Response =>
  apiErrorResponse({
    status: 405,
    code: "METHOD_NOT_ALLOWED",
    message: "This API endpoint only supports GET requests.",
    hint: "Use GET, or consult /openapi.json for a supported endpoint and method.",
    headers: { Allow: "GET" },
  });

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
