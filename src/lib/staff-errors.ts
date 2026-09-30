import type { ApiErrorBody } from "./api-types";

// The API's unexpected-error message is written for customers ("call the store"). Staff are the
// store, so their screens say what actually happened instead. Every other error message is kept.
export const STAFF_SERVER_ERROR = "The server hit a problem and couldn't finish that. Try again in a minute. If it keeps happening, the database may be down.";

/** The message a staff screen shows for a failed API response. */
export async function staffErrorMessage(res: Response, fallback: string): Promise<string> {
  if (res.status === 500) return STAFF_SERVER_ERROR;
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return body?.error || fallback;
}
