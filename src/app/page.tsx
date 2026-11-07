import Browser from "@/components/Browser";
import { getCurrentUser } from "@/lib/auth";
import { getUserClaim } from "@/lib/claims";

export default async function HomePage() {
  const user = await getCurrentUser();
  const claim = user ? await getUserClaim(user.id).catch(() => null) : null;
  return <Browser user={user} initialClaim={claim} />;
}
