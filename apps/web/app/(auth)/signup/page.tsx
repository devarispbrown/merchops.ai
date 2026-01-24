'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

// OAuth provider icons
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function ShopifyIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.337 3.415c-.03-.175-.185-.266-.315-.274-.13-.007-2.77-.058-2.77-.058s-1.837-1.827-2.036-2.028c-.2-.2-.588-.14-.74-.097-.003.001-.4.124-1.073.332C8.097.487 7.743.002 7.258.002c-1.33 0-1.97 1.664-2.17 2.512-.652.202-1.115.345-1.175.364-.367.115-.378.126-.426.47C3.44 3.723 2 15.442 2 15.442l10.59 1.987 5.746-1.435s-2.444-12.03-2.999-12.579zm-4.448-.725c-.52.161-1.094.338-1.692.523-.002-.967-.133-2.327-.572-3.087.718.136 1.2 1.14 1.264 2.564zm-2.75.851c-1.15.355-2.41.745-3.675 1.136.354-1.357 1.032-2.018 1.622-2.264.246-.102.473-.15.666-.15.618 0 .972.483 1.387 1.278zm1.134-3.024c.098 0 .196.013.293.039-.924.435-1.915 1.534-2.333 3.727l-1.327.41C6.424 2.877 7.347 1.517 8.273 1.517z" />
    </svg>
  );
}

function Divider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-200" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="px-4 bg-white text-gray-500">or sign up with email</span>
      </div>
    </div>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/queue';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create account');
        return;
      }

      const loginUrl = `/login?registered=true${returnTo !== '/queue' ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`;
      router.push(loginUrl);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setIsOAuthLoading(provider);
    try {
      await signIn(provider, { callbackUrl: returnTo });
    } catch {
      setError('An error occurred. Please try again.');
      setIsOAuthLoading(null);
    }
  };

  return (
    <Card>
      {/* OAuth Buttons */}
      <div className="space-y-3">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => handleOAuthSignIn('google')}
          disabled={isOAuthLoading !== null}
          className="flex items-center justify-center gap-3"
        >
          {isOAuthLoading === 'google' ? (
            'Connecting...'
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => handleOAuthSignIn('shopify')}
          disabled={isOAuthLoading !== null}
          className="flex items-center justify-center gap-3"
        >
          {isOAuthLoading === 'shopify' ? (
            'Connecting...'
          ) : (
            <>
              <ShopifyIcon />
              Continue with Shopify
            </>
          )}
        </Button>
      </div>

      <Divider />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium mb-2"
          >
            Confirm Password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            required
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="p-3 rounded-md bg-error-light text-error text-sm">
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create Account'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href={`/login${returnTo !== '/queue' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </form>
    </Card>
  );
}

function SignupFormFallback() {
  return (
    <Card>
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-px bg-gray-200 my-6" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFormFallback />}>
      <SignupForm />
    </Suspense>
  );
}
