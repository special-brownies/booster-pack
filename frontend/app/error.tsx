"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page">
      <section className="error-surface">
        <h2>Something went wrong</h2>
        <p>{error.message || "Unexpected UI failure."}</p>
        <button className="btn btn--primary" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}

