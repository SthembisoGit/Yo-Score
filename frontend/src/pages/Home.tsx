import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Code, Award, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const features = [
  {
    icon: Code,
    title: 'Real-World Challenges',
    description: 'Solve coding problems that mirror actual job scenarios across frontend, backend, and security domains.',
  },
  {
    icon: Shield,
    title: 'Proctored Environment',
    description: 'Secure testing with camera monitoring and browser focus tracking to ensure fair assessments.',
  },
  {
    icon: Award,
    title: 'Trust Scoring',
    description: 'Build a verifiable trust score based on your performance, behavior, and work experience.',
  },
  {
    icon: Users,
    title: 'Industry Recognition',
    description: 'Share your score with recruiters and companies looking for proven developer talent.',
  },
];

const stats = [
  { value: '10K+', label: 'Developers' },
  { value: '500+', label: 'Challenges' },
  { value: '150+', label: 'Companies' },
  { value: '98%', label: 'Accuracy' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Prove Your Skills.
              <br />
              Build Your Trust Score.
            </h1>
            <p className="text-lg sm:text-xl opacity-90 mb-8 max-w-2xl">
              YoScore is the developer trust and skill scoring platform that objectively
              evaluates your coding abilities in a secure, proctored environment.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/signup">
                <Button size="lg" variant="secondary" className="gap-2 text-base">
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/challenges">
                <Button
                  size="lg"
                  variant="ghost"
                  className="gap-2 text-base text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Browse Challenges
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative element */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-full bg-primary-foreground/5 -skew-x-12 hidden lg:block" />
      </section>

      {/* Stats Section */}
      <section className="bg-accent py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold font-mono text-primary mb-1">
                  {stat.value}
                </div>
                <div className="text-muted-foreground text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Why Choose YoScore?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We combine rigorous skill assessment with behavior tracking to provide
              the most accurate measure of developer capabilities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-foreground text-background py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Prove Your Skills?
          </h2>
          <p className="text-background/80 max-w-2xl mx-auto mb-8">
            Join thousands of developers who have built their trust score on YoScore.
            Start your journey today.
          </p>
          <Link to="/signup">
            <Button size="lg" variant="secondary" className="gap-2 text-base">
              Create Free Account
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer/>
    </div>
  );
}
