// app/host/layout.tsx
// Server layout so AdminBarGate can read cookies and render AdminBar reliably.

import AdminBarGate from "@/components/AdminBarGate";

export const runtime = "nodejs";

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* AdminBar ONLY if logged in */}
      <AdminBarGate />

      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}