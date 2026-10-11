'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="panel">
      <h2>We couldn’t load this page.</h2>
      <p className="small" role="alert">
        Try again in a moment. Your saved information has not been changed.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
