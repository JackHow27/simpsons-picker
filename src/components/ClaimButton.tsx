"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/types";

export default function ClaimButton({ characterId, name }: { characterId: number; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="detail-claim">
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(`Claim ${name}? Only an admin can change it afterwards.`)) return;
          setBusy(true);
          setError(null);
          try {
            await postJson("/api/claims", { characterId });
            router.refresh();
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Claiming…" : `Claim ${name}`}
      </button>
    </div>
  );
}
