import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, LayoutDashboard, Trophy, Briefcase, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const developerNavLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/challenges', label: 'Challenges', icon: Trophy },
  { to: '/work-experience', label: 'Work Experience', icon: Briefcase },
  { to: '/profile', label: 'Profile', icon: User },
];

const adminNavLinks = [{ to: '/admin', label: 'Admin Dashboard', icon: ShieldCheck }];
const infoLinks = [
  { to: '/about', label: 'About' },
  { to: '/how-it-works', label: 'How It Works' },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const navLinks =
    user?.role === 'admin'
      ? adminNavLinks
      : developerNavLinks;

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;
  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Developer';

  return (
    <nav className="bg-primary text-primary-foreground sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-mono font-bold text-xl">
            <span className="bg-primary-foreground text-primary px-2 py-1 rounded">Yo</span>
            <span>Score</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {isAuthenticated ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.to)
                        ? 'bg-primary-foreground text-primary shadow-sm'
                        : 'hover:bg-primary-foreground/10'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                {infoLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.to)
                        ? 'bg-primary-foreground text-primary shadow-sm'
                        : 'hover:bg-primary-foreground/10'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="ml-4 pl-4 border-l border-primary-foreground/20 flex items-center gap-3">
                  <div className="text-right leading-tight">
                    <p className="text-sm opacity-90">{user?.name}</p>
                    <p className="text-[11px] uppercase tracking-wide opacity-70">{roleLabel}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleLogout}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {infoLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.to)
                        ? 'bg-primary-foreground text-primary shadow-sm'
                        : 'hover:bg-primary-foreground/10'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link to="/login">
                  <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10">
                    Login
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="secondary">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md hover:bg-primary-foreground/10 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden bg-primary border-t border-primary-foreground/20">
          <div className="px-4 py-4 space-y-2">
            {isAuthenticated ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.to)
                        ? 'bg-primary-foreground text-primary shadow-sm'
                        : 'hover:bg-primary-foreground/10'
                    }`}
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                ))}
                {infoLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.to)
                        ? 'bg-primary-foreground text-primary shadow-sm'
                        : 'hover:bg-primary-foreground/10'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pt-4 mt-4 border-t border-primary-foreground/20">
                  <div className="px-4 py-2 text-sm opacity-80">
                    {user?.email}
                    <span className="ml-2 text-[11px] uppercase tracking-wide opacity-70">{roleLabel}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-md text-sm font-medium hover:bg-primary-foreground/10 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {infoLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsOpen(false)}
                    className={`block px-4 py-3 rounded-md text-center font-medium transition-colors ${
                      isActive(link.to)
                        ? 'bg-primary-foreground text-primary shadow-sm'
                        : 'hover:bg-primary-foreground/10'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-3 rounded-md text-center font-medium hover:bg-primary-foreground/10 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-3 rounded-md text-center font-medium bg-primary-foreground text-primary transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
