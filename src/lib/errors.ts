import { extractUpgradeOffer, renderUpgradeOffer, type UpgradeOffer } from "./upgrade.js";
import { authGuidance } from "./auth-guidance.js";

export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unknown error occurred";
}

/**
 * Error carrying a structured upgrade offer, so a caller that wants the raw
 * data (rather than the rendered card) can still reach it.
 */
export class PlanLimitError extends Error {
  readonly offer: UpgradeOffer;

  constructor(offer: UpgradeOffer, rendered: string) {
    super(rendered);
    this.name = "PlanLimitError";
    this.offer = offer;
  }
}

/** Error for a non-2xx API response, carrying the HTTP status. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Render a zod `.flatten()` result — which MisarPost's routes return verbatim
 * as `{ error: { formErrors, fieldErrors } }` on a 400 — as one readable line.
 * Stringifying it naively produced "[object Object]", hiding which field was
 * wrong from the agent that has to fix it.
 */
function describeValidation(value: Record<string, unknown>): string | null {
  const formErrors = Array.isArray(value.formErrors) ? (value.formErrors as unknown[]) : [];
  const fieldErrors =
    typeof value.fieldErrors === "object" && value.fieldErrors !== null
      ? (value.fieldErrors as Record<string, unknown>)
      : null;
  if (!fieldErrors && formErrors.length === 0) return null;

  const parts: string[] = formErrors.map(String);
  for (const [field, errs] of Object.entries(fieldErrors ?? {})) {
    const list = Array.isArray(errs) ? errs.map(String).join(", ") : String(errs);
    parts.push(`${field}: ${list}`);
  }
  return `Invalid request — ${parts.join("; ") || "validation failed"}`;
}

/**
 * Turn a non-2xx API response into an Error carrying the server's own message.
 *
 * MisarPost returns `{ error: string }` on most failures and
 * `{ error: <zod flatten> }` on validation failures. A 401 means the key was
 * presented and refused, so it becomes the generated "rejected" guidance —
 * telling that user to create their first key would hide the real problem.
 *
 * When the body is a plan-limit rejection in the shared upsell contract, the
 * message becomes the full rendered upgrade card, so every tool surfaces it.
 */
export function apiError(status: number, body: unknown): Error {
  const offer = extractUpgradeOffer(body);
  if (offer) return new PlanLimitError(offer, renderUpgradeOffer(offer));

  if (status === 401) return new ApiError(401, authGuidance("rejected"));

  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b.error === "string") {
      // `{ error: "Validation failed", details: <zod flatten> }` on a few routes.
      const details =
        typeof b.details === "object" && b.details !== null
          ? describeValidation(b.details as Record<string, unknown>)
          : null;
      return new ApiError(status, details ? `${b.error}: ${details}` : b.error);
    }
    if (typeof b.error === "object" && b.error !== null) {
      const described = describeValidation(b.error as Record<string, unknown>);
      return new ApiError(status, described ?? JSON.stringify(b.error));
    }
    if (typeof b.message === "string") return new ApiError(status, b.message);
  }
  return new ApiError(status, `HTTP ${status}`);
}
