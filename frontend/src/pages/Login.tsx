import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-accent flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2 font-mono font-bold text-2xl">
          <span className="bg-primary-foreground text-primary px-2 py-1 rounded">Yo</span>
          <span>Score</span>
        </Link>

        <div>
          <h1 className="text-4xl font-bold mb-4">Welcome Back</h1>
          <p className="text-primary-foreground/80 text-lg">
            Continue building your trust score and prove your developer skills
            to the world.
          </p>
        </div>

        <p className="text-primary-foreground/60 text-sm">
          2024 YoScore. All rights reserved.
        </p>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <Link
            to="/"
            className="lg:hidden flex items-center gap-2 font-mono font-bold text-xl mb-8 justify-center"
          >
            <span className="bg-primary text-primary-foreground px-2 py-1 rounded">Yo</span>
            <span>Score</span>
          </Link>

          <div className="bg-card border border-border rounded-lg p-8 shadow-md">
            <h2 className="text-2xl font-bold mb-2">Sign In</h2>
            <p className="text-muted-foreground mb-6">
              Enter your credentials to access your account
            </p>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader size="sm" className="border-primary-foreground" /> : 'Sign In'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Do not have an account?{' '}
              <Link to="/signup" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
