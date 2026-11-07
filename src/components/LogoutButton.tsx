"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/types";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await postJson("/api/auth/logout", {}).catch(() => undefined);
        router.push("/");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
