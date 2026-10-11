import Link from 'next/link';
export default function Home() {
  return (
    <main className="shell">
      <div className="eyebrow">BLOOMERS · FOUNDATION PREVIEW</div>
      <section className="hero">
        <div className="mark">✳</div>
        <h1>
          Every learner
          <br />
          <em>can bloom.</em>
        </h1>
        <p>
          Meet Maya, your personal AI tutor. A learning journey that remembers
          your progress, builds confidence, and grows with you.
        </p>
        <div className="notice">
          We’re building the foundation. Parent accounts are ready. Live lessons
          are coming in the next phases.
        </div>
        <div className="hero-actions">
          <Link className="button" href="/auth/sign-up">
            Create a parent account
          </Link>
          <Link href="/auth/sign-in">Sign in →</Link>
        </div>
      </section>
      <footer>Bloomers V1 · Phase 1</footer>
    </main>
  );
}
