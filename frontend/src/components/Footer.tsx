import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-muted py-12 mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 font-mono font-bold text-xl">
            <span className="bg-primary text-primary-foreground px-2 py-1 rounded">Yo</span>
            <span>Score</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link to="/how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link to="/challenges" className="hover:text-foreground transition-colors">
              Challenges
            </Link>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">2026 YoScore. All rights reserved.</p>
      </div>
    </footer>
  );
}
