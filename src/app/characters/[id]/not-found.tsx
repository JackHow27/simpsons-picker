import Link from "next/link";

export default function CharacterNotFound() {
  return (
    <div className="card auth-card">
      <h1>Character not found</h1>
      <p className="muted">That character isn&apos;t in the list.</p>
      <p>
        <Link href="/">Back to the picker</Link>
      </p>
    </div>
  );
}
