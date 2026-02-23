export function PublicShell(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(168,85,247,0.35),transparent_55%),radial-gradient(900px_circle_at_80%_10%,rgba(99,102,241,0.25),transparent_55%),linear-gradient(to_bottom,#050008,#000000)] text-white">
      {props.children}
    </div>
  );
}