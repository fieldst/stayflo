// stayflo/app/host/layout.tsx

import AdminBarGate from "@/components/AdminBarGate";

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* 🔐 Admin-only top bar */}
      <AdminBarGate />

      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
