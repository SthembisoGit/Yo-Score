import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function About() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 space-y-8">
        <header>
          <h1 className="text-3xl font-bold mb-2">About YoScore</h1>
          <p className="text-muted-foreground">
            YoScore is a developer trust and skill scoring platform built for AI-era hiring.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-xl font-semibold">Why It Exists</h2>
          <p className="text-sm text-muted-foreground">
            AI tools can speed up software delivery, but teams still need proof that a developer
            understands fundamentals. YoScore evaluates practical coding ability in proctored
            sessions and produces an auditable trust score.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-xl font-semibold">Core Principles</h2>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Assess real coding outcomes, not resume buzzwords.</li>
            <li>Use AI guidance in a controlled way that preserves understanding.</li>
            <li>Keep scoring explainable with clear component breakdowns.</li>
            <li>Preserve fairness through transparent proctoring evidence.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-xl font-semibold">Who Uses It</h2>
          <p className="text-sm text-muted-foreground">
            Developers use YoScore to prove capability and track improvement. Admins and
            institutions configure challenge quality, monitor scoring reliability, and review
            proctoring evidence when needed.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
