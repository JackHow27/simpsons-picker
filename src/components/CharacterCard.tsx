"use client";

import Link from "next/link";
import type { ClientCharacter, ClientUser } from "@/lib/types";

type Props = {
  character: ClientCharacter;
  user: ClientUser | null;
  hasClaim: boolean;
  busy: boolean;
  onClaim: (c: ClientCharacter) => void;
};

export default function CharacterCard({ character, user, hasClaim, busy, onClaim }: Props) {
  const { claim } = character;
  const mine = !!user && claim?.userId === user.id;

  return (
    <article className={`char-card ${claim ? "is-taken" : ""} ${mine ? "is-mine" : ""}`} data-character-id={character.id}>
      <Link href={`/characters/${character.id}`} className="char-card-link">
        <div className="char-portrait">
          {character.imageUrl ? (
            <img src={character.imageUrl} alt="" loading="lazy" />
          ) : (
            <div className="char-placeholder" aria-hidden>
              ?
            </div>
          )}
        </div>
        <div className="char-body">
          <h3 className="char-name" title={character.name}>
            {character.name}
          </h3>
          {character.occupation && <p className="char-occupation">{character.occupation}</p>}
          {mine ? (
            <span className="badge badge-mine">Yours</span>
          ) : claim ? (
            <span className="badge badge-taken">Taken by {claim.displayName}</span>
          ) : (
            <span className="badge badge-free">Available</span>
          )}
        </div>
      </Link>
      {user && !claim && !hasClaim && (
        <div className="char-actions">
          <button className="btn btn-primary btn-sm char-claim" disabled={busy} onClick={() => onClaim(character)}>
            Claim
          </button>
        </div>
      )}
    </article>
  );
}
