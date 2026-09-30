import { describe, expect, it } from "vitest";
import { STAFF_SERVER_ERROR, staffErrorMessage } from "./staff-errors";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("staff error messages", () => {
  it("replaces the customer-facing 500 message", async () => {
    const res = json(500, { error: "Something went wrong. Please try again or call the store." });
    expect(await staffErrorMessage(res, "Sign in failed")).toBe(STAFF_SERVER_ERROR);
  });

  it("keeps the server's message for other errors", async () => {
    expect(await staffErrorMessage(json(401, { error: "Wrong email or password" }), "Sign in failed")).toBe("Wrong email or password");
    expect(await staffErrorMessage(json(423, { error: "Too many attempts. Try again in 15 minutes." }), "Sign in failed")).toBe(
      "Too many attempts. Try again in 15 minutes.",
    );
  });

  it("falls back when the body isn't JSON", async () => {
    expect(await staffErrorMessage(new Response("<html>Bad gateway</html>", { status: 502 }), "Save failed")).toBe("Save failed");
  });
});
