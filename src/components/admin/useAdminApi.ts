"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiErrorBody } from "@/lib/api-types";

/** PATCH helper for admin screens: tracks busy/error state and refreshes server data on success. */
export function useAdminApi() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const patch = async (url: string, body: unknown, successMessage = "Saved") => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 401) {
        router.replace("/admin/login");
        return false;
      }
      if (!res.ok) {
        const b = (await res.json().catch(() => ({ error: "Save failed" }))) as ApiErrorBody;
        setError(b.error);
        return false;
      }
      setSaved(successMessage);
      router.refresh();
      return true;
    } catch {
      setError("Can't reach the server. Check the connection.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { patch, busy, error, saved };
}
