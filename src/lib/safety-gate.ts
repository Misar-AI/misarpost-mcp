import { ContentSafety } from "./content-safety/content-safety.js";

/** Tools whose arguments carry text that will be published or turned into posts. */
const ARG_FIELDS: Record<string, string[]> = {
  schedule_post: ["content_text", "contentText", "first_comment", "firstComment"],
  update_post: ["content_text", "contentText", "first_comment", "firstComment"],
  update_content_variant: ["content"],
};

/** Source text that only feeds generation: checked for harm only, not for publishing-quality rules. */
const SOURCE_FIELDS: Record<string, string[]> = {
  generate_posts: ["topic"],
  repurpose_content: ["raw_content", "rawContent"],
};

/** Tools whose result holds AI-written post text. */
const RESULT_TOOLS = new Set(["generate_posts", "repurpose_content"]);

/** Result keys that hold user-facing post text. */
const RESULT_TEXT_KEYS = new Set(["content", "content_text", "contentText", "text", "caption", "body", "hook", "title", "first_comment"]);

/** Thrown when the shared safety check blocks a post; surfaces as an MCP tool error. */
export class ContentSafetyError extends Error {
  constructor(readonly reasons: string[]) {
    super(`Blocked by the content safety check: ${reasons.join("; ")}`);
    this.name = "ContentSafetyError";
  }
}

/** Collect string values under the known text keys, at any depth. */
function collectResultText(node: unknown, out: string[]): void {
  if (Array.isArray(node)) return node.forEach((n) => collectResultText(n, out));
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string" && RESULT_TEXT_KEYS.has(key)) out.push(value);
    else collectResultText(value, out);
  }
}

/** The non-empty string values of the named argument fields. */
function pickFields(args: Record<string, unknown>, fields: string[] | undefined): string[] {
  return (fields ?? []).map((f) => args[f]).filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/** The user-facing text of a tool call: its publishable arguments, plus its result when `result` is given. */
export function collectPostText(tool: string, args: Record<string, unknown>, result?: unknown): string[] {
  const out = pickFields(args, ARG_FIELDS[tool]);
  if (result !== undefined && RESULT_TOOLS.has(tool)) collectResultText(result, out);
  return out;
}

/** Source text a generation tool will work from (topic, raw content). */
export function collectSourceText(tool: string, args: Record<string, unknown>): string[] {
  return pickFields(args, SOURCE_FIELDS[tool]);
}

/** Throw ContentSafetyError when any text gets a "block" verdict (adult audience). */
export function assertSafeText(texts: string[], where: string): void {
  const safety = ContentSafety.get();
  const reasons: string[] = [];
  for (const text of texts) {
    const report = safety.checkText(text, "adult", where);
    if (report.verdict === "block") reasons.push(...report.problems.filter((p) => p.level === "block").map((p) => p.why));
  }
  if (reasons.length) throw new ContentSafetyError([...new Set(reasons)]);
}

/** Harm-only check (child safety, hate, dangerous instructions) on source text; throws on "block". */
export function assertSafeSource(texts: string[], where: string): void {
  const safety = ContentSafety.get();
  const reasons = texts.flatMap((text) => safety.checkForHarm(text, "adult", where).problems.filter((p) => p.level === "block").map((p) => p.why));
  if (reasons.length) throw new ContentSafetyError([...new Set(reasons)]);
}
