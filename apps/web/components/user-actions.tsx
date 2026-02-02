"use client";

export function LogoutButton({ apiOrigin }: { apiOrigin: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
      onClick={async () => {
        await fetch(`${apiOrigin}/auth/logout`, { method: "POST", credentials: "include" });
        window.location.reload();
      }}
    >
      Logout
    </button>
  );
}

