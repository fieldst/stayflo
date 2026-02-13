// components/AdminBarGate.tsx
// Server-side gate: only render AdminBar when the admin cookie is present.
// Works in Next versions where cookies() is async.

import { cookies } from "next/headers";
import AdminBar from "@/components/AdminBar";

const COOKIE = "stayflo_admin";

export default async function AdminBarGate() {
  const jar = await cookies();
  const val = jar.get(COOKIE)?.value;

  // Depending on your login route, this might be "1" or "true"
  const isAuthed = val === "1" || val === "true";

  if (!isAuthed) return null;
  return <AdminBar />;
}