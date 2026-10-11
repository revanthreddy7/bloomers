'use client';
export default function PreviewError({ reset }: { reset: () => void }) {
  return (
    <main className="panel">
      <h1>We couldn’t load your learning space.</h1>
      <p>Ask your parent to check your access, or try again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
