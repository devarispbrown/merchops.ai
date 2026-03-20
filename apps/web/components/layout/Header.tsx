'use client';

import { signOut, useSession } from 'next-auth/react';

import { Button } from '@/components/ui/Button';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="border-b border-border bg-card">
      <div className="flex h-16 items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-4">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            className="lg:hidden -ml-2 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-calm"
            onClick={onMenuToggle}
            aria-label="Open navigation menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div className="lg:hidden">
            <h1 className="text-xl font-semibold text-foreground">MerchOps</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {session?.user && (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-foreground">
                  {session.user.email}
                </p>
                <p className="text-xs text-muted-foreground">Your Workspace</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                Sign out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
