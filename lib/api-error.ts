export const apiErrorCodes = [
  "INVALID_REQUEST",
  "ORIGIN_NOT_ALLOWED",
  "RATE_LIMITED",
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    hint: string;
    details?: unknown;
  };
}

interface ApiErrorResponseOptions {
  status: number;
  code: ApiErrorCode;
  message: string;
  hint: string;
  details?: unknown;
  headers?: HeadersInit;
}

export const apiErrorResponse = ({
  status,
  code,
  message,
  hint,
  details,
  headers,
}: ApiErrorResponseOptions): Response => {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      hint,
      ...(details === undefined ? {} : { details }),
    },
  };

  return Response.json(body, { status, headers });
};

export const invalidRequestResponse = (details?: unknown): Response =>
  apiErrorResponse({
    status: 400,
    code: "INVALID_REQUEST",
    message: "The request is invalid.",
    hint: "Send valid JSON that matches the endpoint schema documented at /openapi.json.",
    details,
  });

export const originNotAllowedResponse = (): Response =>
  apiErrorResponse({
    status: 403,
    code: "ORIGIN_NOT_ALLOWED",
    message: "Cross-origin requests are not allowed.",
    hint: "Send this request from aikc.vn or from a same-origin server-side client.",
  });

export const internalServerErrorResponse = (): Response =>
  apiErrorResponse({
    status: 500,
    code: "INTERNAL_ERROR",
    message: "The server could not complete the request.",
    hint: "Retry later. If the problem continues, contact the site operator with the endpoint and time of the request.",
  });
