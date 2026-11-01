/**
 * Role enforcement is server-side, on the route handlers themselves — the same
 * handlers an evaluator would hit with curl/Postman. The database module is
 * replaced by an object that throws if touched, proving the role check happens
 * before any data access.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeProfile = { id: string; role: "CITIZEN" | "OPERATOR"; wardId: string | null; language: string };
let session: FakeProfile | null = null;

vi.mock("@/lib/auth", () => ({ getSessionProfile: async () => session }));
vi.mock("@/lib/db", () => ({
  prisma: new Proxy({}, { get: () => { throw new Error("database must not be reached"); } }),
}));

const citizen: FakeProfile = { id: "c1", role: "CITIZEN", wardId: "w1", language: "en" };
const operator: FakeProfile = { id: "o1", role: "OPERATOR", wardId: null, language: "en" };

const jsonRequest = (url: string, body: unknown, method = "POST") =>
  new Request(`http://localhost${url}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function errorCode(response: Response) {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

beforeEach(() => {
  session = null;
});

describe("operator-only routes", () => {
  const eventBody = { serviceId: "s1", eventType: "holiday", affectedDate: "2030-01-07", reason: "a municipal holiday", source: "MCC Circular" };

  it("POST /api/events as a CITIZEN → 403", async () => {
    session = citizen;
    const { POST } = await import("@/app/api/events/route");
    const response = await POST(jsonRequest("/api/events", eventBody), undefined as never);
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("FORBIDDEN");
  });

  it("POST /api/events signed out → 401", async () => {
    const { POST } = await import("@/app/api/events/route");
    expect((await POST(jsonRequest("/api/events", eventBody), undefined as never)).status).toBe(401);
  });

  it.each([
    ["@/app/api/events/[id]/verify/route", { expectedUpdatedAt: new Date().toISOString() }],
    ["@/app/api/events/[id]/withdraw/route", { expectedUpdatedAt: new Date().toISOString(), reason: "x" }],
    ["@/app/api/arrangements/[id]/verify/route", { expectedUpdatedAt: new Date().toISOString() }],
  ])("%s as a CITIZEN → 403", async (modulePath, body) => {
    session = citizen;
    const { POST } = (await import(/* @vite-ignore */ modulePath)) as { POST: (r: Request, c: unknown) => Promise<Response> };
    expect((await POST(jsonRequest("/x", body), params("evt"))).status).toBe(403);
  });

  it("POST /api/arrangements as a CITIZEN → 403", async () => {
    session = citizen;
    const { POST } = await import("@/app/api/arrangements/route");
    expect((await POST(jsonRequest("/api/arrangements", {}), undefined as never)).status).toBe(403);
  });

  it("POST /api/ai/extract as a CITIZEN → 403", async () => {
    session = citizen;
    const { POST } = await import("@/app/api/ai/extract/route");
    expect((await POST(jsonRequest("/api/ai/extract", { text: "x" }), undefined as never)).status).toBe(403);
  });

  it("PATCH /api/complaints/[id] as a CITIZEN → 403", async () => {
    session = citizen;
    const { PATCH } = await import("@/app/api/complaints/[id]/route");
    expect((await PATCH(jsonRequest("/x", { status: "resolved" }, "PATCH"), params("cmp"))).status).toBe(403);
  });

  it("POST /api/operator/demo-refresh as a CITIZEN → 403", async () => {
    session = citizen;
    const { POST } = await import("@/app/api/operator/demo-refresh/route");
    expect((await POST(jsonRequest("/x", {}), undefined as never)).status).toBe(403);
  });
});

describe("citizen-only routes", () => {
  it("POST /api/complaints as an OPERATOR → 403", async () => {
    session = operator;
    const { POST } = await import("@/app/api/complaints/route");
    expect((await POST(jsonRequest("/api/complaints", {}), undefined as never)).status).toBe(403);
  });

  it("POST /api/ai/answer as an OPERATOR → 403", async () => {
    session = operator;
    const { POST } = await import("@/app/api/ai/answer/route");
    expect((await POST(jsonRequest("/api/ai/answer", { question: "x" }), undefined as never)).status).toBe(403);
  });

  it("POST /api/ai/answer as a CITIZEN without a ward → 409 WARD_REQUIRED (no null-ward queries)", async () => {
    session = { ...citizen, wardId: null };
    const { POST } = await import("@/app/api/ai/answer/route");
    const response = await POST(jsonRequest("/api/ai/answer", { question: "x" }), undefined as never);
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("WARD_REQUIRED");
  });
});

describe("cron endpoint", () => {
  it("rejects requests without the correct secret (401) and accepts both header forms", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-0123456789");
    const { isAuthorizedCronRequest } = await import("@/lib/cron-auth");
    const { GET, POST } = await import("@/app/api/cron/sync/route");
    expect((await POST(new Request("http://localhost/api/cron/sync", { method: "POST" }), undefined as never)).status).toBe(401);
    expect(
      (await GET(new Request("http://localhost/api/cron/sync", { headers: { "x-cron-secret": "wrong" } }), undefined as never)).status,
    ).toBe(401);
    expect(isAuthorizedCronRequest(new Request("http://x", { headers: { "x-cron-secret": "test-cron-secret-0123456789" } }))).toBe(true);
    expect(isAuthorizedCronRequest(new Request("http://x", { headers: { authorization: "Bearer test-cron-secret-0123456789" } }))).toBe(true);
    vi.unstubAllEnvs();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    const { isAuthorizedCronRequest } = await import("@/lib/cron-auth");
    expect(isAuthorizedCronRequest(new Request("http://x", { headers: { "x-cron-secret": "" } }), undefined)).toBe(false);
    expect(isAuthorizedCronRequest(new Request("http://x", { headers: { "x-cron-secret": "short" } }), "short")).toBe(false);
  });
});

describe("input validation", () => {
  it("rejects non-JSON bodies and malformed JSON before touching the database", async () => {
    session = operator;
    const { POST } = await import("@/app/api/events/route");
    const wrongType = new Request("http://localhost/api/events", { method: "POST", body: "x", headers: { "content-type": "text/plain" } });
    expect((await POST(wrongType, undefined as never)).status).toBe(415);
    const malformed = new Request("http://localhost/api/events", { method: "POST", body: "{", headers: { "content-type": "application/json" } });
    expect((await POST(malformed, undefined as never)).status).toBe(400);
    const missing = jsonRequest("/api/events", { serviceId: "s1", eventType: "holiday", reason: "x" });
    const response = await POST(missing, undefined as never);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("VALIDATION_FAILED");
  });
});
