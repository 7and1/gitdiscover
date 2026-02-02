import { apiGetServer } from "./server-api";
import type { UserResponse } from "./types";

export async function getCurrentUser(): Promise<UserResponse["data"] | null> {
  try {
    const res = await apiGetServer<UserResponse>("/user", { cache: "no-store" });
    return res.data;
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") return null;
    throw err;
  }
}

