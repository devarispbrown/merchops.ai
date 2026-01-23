'use client';

import { signOut, useSession } from 'next-auth/react';

import { Button } from '@/components/ui/Button';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-border bg-card">
      <div className="flex h-16 items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="lg:hidden">
            <h1 className="text-xl font-semibold text-foreground">MerchOps</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {session?.user && (
            <>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  {session.user.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Your Workspace
                </p>
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
