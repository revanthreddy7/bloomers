'use client';
export default function CurriculumError({ reset }: { reset: () => void }) {
  return (
    <main className="account-content">
      <h1>Curriculum is unavailable</h1>
      <p>Please try again.</p>
      <button onClick={reset}>Retry</button>
    </main>
  );
}
