import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      setEmailError('Email address is required');
      isValid = false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || isLoading) return;

    setError('');

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      const backendError = err.message || err.response?.message || '';
      const statusCode = err.status;

      let displayError = 'Login failed. Please check your credentials.';

      if (backendError.includes('Invalid credentials') || backendError.includes('UNAUTHORIZED')) {
        displayError = 'The email or password you entered is incorrect.';
      } else if (backendError.includes('User not found')) {
        displayError = 'No account found with this email address.';
      } else if (backendError.includes('Invalid password')) {
        displayError = 'Incorrect password. Please try again.';
      } else if (statusCode === 401) {
        displayError = 'Invalid email or password.';
      } else if (statusCode === 403) {
        displayError = 'Access denied. Account may be disabled.';
      } else if (statusCode === 429) {
        displayError = 'Too many login attempts. Please wait and try again.';
      } else if (statusCode === 500) {
        displayError = 'Server error. Please try again later.';
      } else if (statusCode === 0 || backendError.includes('Network')) {
        displayError = 'Unable to connect to server. Check your connection.';
      } else if (backendError) {
        displayError = backendError;
      }

      setError(displayError);
      setPassword('');


      if (emailInputRef.current) {
        emailInputRef.current.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  };



  const isLoadingState =isSubmitting;

  return (
    <div className="min-h-screen bg-accent flex">
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

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
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
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-destructive" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-destructive font-medium">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  ref={emailInputRef}
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                    if (error) setError('');
                  }}
                  autoComplete="email"
                  className={emailError ? 'border-destructive' : ''}
                  disabled={isLoadingState}
                  aria-invalid={!!emailError}
                />
                {emailError && (
                  <p className="text-xs text-destructive mt-1">{emailError}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary hover:text-primary/80 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError('');
                      if (error) setError('');
                    }}
                    autoComplete="current-password"
                    className={passwordError ? 'border-destructive' : ''}
                    disabled={isLoadingState}
                    aria-invalid={!!passwordError}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoadingState}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-destructive mt-1">{passwordError}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-10"
                disabled={isLoadingState}
              >
                {isLoadingState ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-center text-sm text-muted-foreground">
                Do not have an account?{' '}
                <Link
                  to="/signup"
                  className="text-primary font-medium hover:underline"
                >
                  Create account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}