// components/AdminBarGate.tsx
// Server-side gate: only render AdminBar when the admin cookie is present.
// This prevents guests from ever seeing the AdminBar (no flicker) and ensures
// it disappears immediately after logout redirect.

import { cookies } from "next/headers";
import AdminBar from "@/components/AdminBar";

const COOKIE = "stayflo_admin";

export default function AdminBarGate() {
  const jar = cookies();
  const isAuthed = jar.get(COOKIE)?.value === "1";
  if (!isAuthed) return null;
  return <AdminBar />;
}
