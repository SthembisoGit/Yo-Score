import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const steps = [
  {
    title: '1. Choose Category',
    description:
      'Pick a track like Frontend, Backend, or Security. YoScore assigns the next challenge based on your category and seniority band.',
  },
  {
    title: '2. Start Proctored Session',
    description:
      'Camera, microphone, and audio checks are required before the challenge starts. If a required device is disabled, the session pauses.',
  },
  {
    title: '3. Solve With Timed Editor',
    description:
      'Write your solution inside the built-in editor. You can request up to three AI coach hints for concept guidance.',
  },
  {
    title: '4. Submit And Judge',
    description:
      'Your code is queued for automated test execution. The judge returns correctness, efficiency, and style components using hidden tests and language baselines.',
  },
  {
    title: '5. Receive Trust Feedback',
    description:
      'Results combine skill score, proctoring behavior, and work-experience contribution. You also get practice guidance for weak areas.',
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 space-y-8">
        <header>
          <h1 className="text-3xl font-bold mb-2">How YoScore Works</h1>
          <p className="text-muted-foreground">
            End-to-end flow from challenge assignment to trust scoring.
          </p>
        </header>

        <div className="space-y-4">
          {steps.map((step) => (
            <section key={step.title} className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold mb-2">{step.title}</h2>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </section>
          ))}
        </div>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-2">Offline And Fairness Handling</h2>
          <p className="text-sm text-muted-foreground">
            Drafts autosave locally while coding. If network drops, the timer still runs and the
            latest draft is submitted automatically once connection returns (within grace window).
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-2">Scoring Principles</h2>
          <p className="text-sm text-muted-foreground">
            YoScore does not require exact code matches. Correctness is based on hidden case outcomes,
            so alternative valid implementations are scored fairly. Partial progress earns partial credit.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-2">Challenge Rotation Rules</h2>
          <p className="text-sm text-muted-foreground">
            Completed challenges are excluded from automatic reassignment for 30 days per category, so
            users keep receiving fresh, level-appropriate tasks.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
