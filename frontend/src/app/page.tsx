export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-deep px-6 text-center">
      <div className="space-y-6">
        <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
          Phase 0 — bootstrap
        </p>
        <h1 className="text-5xl font-semibold uppercase tracking-[0.05em] text-text sm:text-6xl">
          Sharp <span className="text-primary">Arena</span>
        </h1>
        <p className="mx-auto max-w-xl text-text-dim">
          Game-style programming challenges. Two modes share one engine — Arena
          for free practice, Story for narrative progression. C# first,
          multi-language ready.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4 font-mono text-xs uppercase tracking-widest text-text-muted">
          <span className="rounded-md border border-border-subtle bg-bg-panel px-3 py-1">
            .NET 10
          </span>
          <span className="rounded-md border border-border-subtle bg-bg-panel px-3 py-1">
            Next 16
          </span>
          <span className="rounded-md border border-border-subtle bg-bg-panel px-3 py-1">
            Postgres 17
          </span>
        </div>
      </div>
    </main>
  );
}
