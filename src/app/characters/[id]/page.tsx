import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CharacterDetail from "@/components/CharacterDetail";
import { getCurrentUser } from "@/lib/auth";
import { getCharacterWithClaim, getUserClaim } from "@/lib/claims";
import { getCharacter } from "@/lib/simpsons";

function parseId(raw: string) {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = parseId((await params).id);
  const character = id ? await getCharacter(id).catch(() => null) : null;
  return { title: character ? `${character.name} · Simpsons Picker` : "Character · Simpsons Picker" };
}

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();

  let character;
  try {
    character = await getCharacterWithClaim(id);
  } catch (err) {
    console.error(err);
    return (
      <div className="card">
        <p className="alert alert-error">Could not load this character. Try again in a moment.</p>
        <p>
          <Link href="/">Back to the picker</Link>
        </p>
      </div>
    );
  }
  if (!character) notFound();

  const user = await getCurrentUser();
  const mine = user ? await getUserClaim(user.id).catch(() => null) : null;
  return <CharacterDetail character={character} user={user} hasClaim={!!mine} />;
}
