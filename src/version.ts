/**
 * The server's identity, in one place.
 *
 * 2.x hardcoded the version in index.ts, which is exactly how a sibling server
 * kept reporting "3.0.0" on `initialize` long after it reached 5.x. Read it from
 * package.json — always shipped by npm, one level above dist/ — so it cannot
 * drift again.
 */
import { createRequire } from "node:module";

export const SERVER_NAME = "misarpost";
export const SERVER_VERSION: string = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;
