import "server-only";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { HttpError } from "@/lib/errors";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Convert any thrown value into a safe JSON error. Stack traces are logged, never returned. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: { code: "DUPLICATE", message: "This record already exists." } }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Record not found." } }, { status: 404 });
    }
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
}

/** Wrap a route handler so every failure becomes a structured JSON error. */
export function route<Ctx>(handler: (request: Request, ctx: Ctx) => Promise<Response>) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(request, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function zodDetails(error: z.ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

export function parseWith<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, "VALIDATION_FAILED", "Some fields are invalid.", zodDetails(result.error));
  return result.data;
}

/** Read and validate a JSON body, enforcing content type and a size cap. */
export async function readJson<S extends z.ZodType>(request: Request, schema: S, maxBytes = 64 * 1024): Promise<z.infer<S>> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as application/json.");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  let data: unknown;
  try {
    data = text.length ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
  return parseWith(schema, data);
}

export function searchParamsObject(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
