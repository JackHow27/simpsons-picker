import Link from "next/link";
import ClaimButton from "./ClaimButton";
import type { PublicUser } from "@/lib/auth";
import type { CharacterWithClaim } from "@/lib/claims";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatBirthdate(iso: string | null) {
  const match = iso && /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}, ${match[1]}` : iso;
}

export default function CharacterDetail({
  character,
  user,
  hasClaim,
}: {
  character: CharacterWithClaim;
  user: PublicUser | null;
  hasClaim: boolean;
}) {
  const mine = !!user && character.claim?.userId === user.id;
  const canClaim = !!user && !character.claim && !hasClaim;

  return (
    <article className="detail-page">
      <p className="detail-top">
        <Link href="/" className="back-link">
          ← All characters
        </Link>
      </p>
      <div className="card detail">
        <div className="detail-portrait">
          {character.imageUrl ? (
            <img src={character.imageUrl} alt={character.name} />
          ) : (
            <div className="char-placeholder" aria-hidden>
              ?
            </div>
          )}
        </div>
        <div className="detail-info">
          <h1>{character.name}</h1>
          {mine ? (
            <span className="badge badge-mine">Yours</span>
          ) : character.claim ? (
            <span className="badge badge-taken">Taken by {character.claim.displayName}</span>
          ) : (
            <span className="badge badge-free">Available</span>
          )}

          <dl className="detail-fields">
            <dt>Age</dt>
            <dd>{character.age ?? "Unknown"}</dd>
            <dt>Birthdate</dt>
            <dd>{formatBirthdate(character.birthdate) ?? "Unknown"}</dd>
            <dt>Gender</dt>
            <dd>{character.gender ?? "Unknown"}</dd>
            <dt>Occupation</dt>
            <dd>{character.occupation ?? "Unknown"}</dd>
            <dt>Status</dt>
            <dd>{character.status ?? "Unknown"}</dd>
          </dl>

          <h2>Phrases</h2>
          {character.phrases.length > 0 ? (
            <ul className="phrases">
              {character.phrases.map((phrase, index) => (
                <li key={`${index}-${phrase}`}>{phrase}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No phrases listed.</p>
          )}

          {canClaim && <ClaimButton characterId={character.id} name={character.name} />}
          {!user && !character.claim && (
            <p className="detail-note">
              <Link href="/login">Log in</Link> or <Link href="/register">sign up</Link> to claim {character.name}.
            </p>
          )}
          {user && !mine && !character.claim && hasClaim && (
            <p className="detail-note">You already have a character. Only an admin can change it.</p>
          )}
        </div>
      </div>
    </article>
  );
}
