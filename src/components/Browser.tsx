"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CharacterCard from "./CharacterCard";
import { postJson, type ClientCharacter, type ClientUser } from "@/lib/types";

const CAROUSEL_SIZE = 5;
const PAGE_SIZE = 24;

type Props = { user: ClientUser | null; initialClaim: ClientCharacter | null };

export default function Browser({ user, initialClaim }: Props) {
  const [myClaim, setMyClaim] = useState<ClientCharacter | null>(initialClaim);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  const onClaim = useCallback(
    async (character: ClientCharacter) => {
      if (!window.confirm(`Claim ${character.name}? Only an admin can change it afterwards.`)) return;
      setBusy(true);
      setMessage(null);
      try {
        const { claim } = await postJson<{ claim: ClientCharacter }>("/api/claims", { characterId: character.id });
        setMyClaim(claim);
        setMessage({ kind: "success", text: `You claimed ${claim.name}!` });
      } catch (err) {
        setMessage({ kind: "error", text: (err as Error).message });
      } finally {
        setBusy(false);
        setVersion((v) => v + 1);
      }
    },
    [],
  );

  const cardProps = { user, hasClaim: !!myClaim, busy, onClaim };

  return (
    <div className="browser">
      <section className="hero">
        <div>
          <h1>Pick your Simpsons character</h1>
          <p className="muted">
            Everyone gets one character. Once it&apos;s yours, it&apos;s yours, unless an admin steps in.
          </p>
        </div>
        {!user ? (
          <div className="card callout">
            <p>
              <Link href="/register">Sign up</Link> or <Link href="/login">log in</Link> to claim a character.
            </p>
          </div>
        ) : myClaim ? (
          <div className="card my-claim" data-testid="my-claim">
            {myClaim.imageUrl && (
              <img src={myClaim.imageUrl} alt="" />
            )}
            <div>
              <p className="eyebrow">Your character</p>
              <h2>{myClaim.name}</h2>
              <p className="muted small">Only an admin can release or change your pick.</p>
            </div>
          </div>
        ) : (
          <div className="card callout">
            <p>You haven&apos;t picked yet. Choose an available character below.</p>
          </div>
        )}
      </section>

      {message && (
        <p className={`alert alert-${message.kind}`} role="status">
          {message.text}
        </p>
      )}

      <Carousel version={version} cardProps={cardProps} />
      <Search version={version} cardProps={cardProps} />
    </div>
  );
}

type CardProps = Omit<React.ComponentProps<typeof CharacterCard>, "character">;

function Carousel({ version, cardProps }: { version: number; cardProps: CardProps }) {
  const [start, setStart] = useState(0);
  const [data, setData] = useState<{ total: number; results: ClientCharacter[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/characters/carousel?start=${start}&size=${CAROUSEL_SIZE}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      })
      .catch((err) => !cancelled && setError(err.message || "Could not load characters."));
    return () => {
      cancelled = true;
    };
  }, [start, version]);

  const total = data?.total ?? 0;
  const step = (delta: number) => setStart((s) => (total ? (((s + delta) % total) + total) % total : 0));

  return (
    <section
      className="carousel-section"
      aria-roledescription="carousel"
      aria-label="Browse characters"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
      }}
    >
      <div className="section-head">
        <h2>Browse</h2>
        <div className="carousel-controls">
          <span className="muted small" data-testid="carousel-position">
            {total ? `${start + 1}–${Math.min(start + CAROUSEL_SIZE, start + total)} of ${total}` : ""}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setStart(Math.floor(Math.random() * (total || 1)))}>
            Shuffle
          </button>
        </div>
      </div>
      {error ? (
        <p className="alert alert-error">{error}</p>
      ) : !data ? (
        <p className="muted">Loading characters… (the first load fetches the full list and can take a few seconds)</p>
      ) : (
        <div className="carousel">
          <button className="carousel-arrow" aria-label="Previous" onClick={() => step(-CAROUSEL_SIZE)}>
            ‹
          </button>
          <div className="carousel-track">
            {data.results.map((c) => (
              <CharacterCard key={c.id} character={c} {...cardProps} />
            ))}
          </div>
          <button className="carousel-arrow" aria-label="Next" onClick={() => step(CAROUSEL_SIZE)}>
            ›
          </button>
        </div>
      )}
    </section>
  );
}

function Search({ version, cardProps }: { version: number; cardProps: CardProps }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [data, setData] = useState<{ total: number; results: ClientCharacter[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query.trim());
      setLimit(PAGE_SIZE);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) {
      setData(null);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    fetch(`/api/characters?q=${encodeURIComponent(debounced)}&limit=${limit}`)
      .then((res) => res.json())
      .then((body) => id === requestId.current && setData(body))
      .finally(() => id === requestId.current && setLoading(false));
  }, [debounced, limit, version]);

  return (
    <section className="search-section">
      <div className="section-head">
        <h2>Search</h2>
      </div>
      <input
        className="search-input"
        type="search"
        placeholder="Search by name, e.g. Homer, Flanders, Moe…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search characters by name"
      />
      {debounced && data && (
        <>
          <p className="muted small" data-testid="search-count">
            {data.total} match{data.total === 1 ? "" : "es"} for “{debounced}”
          </p>
          <div className="grid">
            {data.results.map((c) => (
              <CharacterCard key={c.id} character={c} {...cardProps} />
            ))}
          </div>
          {data.total > data.results.length && (
            <button className="btn btn-ghost load-more" disabled={loading} onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              {loading ? "Loading…" : "Show more"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
