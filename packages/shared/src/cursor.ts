import { z } from "zod";

const CursorPayloadSchema = z.object({
  id: z.number().int().positive(),
  v: z.number().optional()
});

export type CursorPayload = z.infer<typeof CursorPayloadSchema>;

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(raw: string): CursorPayload {
  let parsed: unknown;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error("INVALID_CURSOR");
  }
  const result = CursorPayloadSchema.safeParse(parsed);
  if (!result.success) throw new Error("INVALID_CURSOR");
  return result.data;
}
