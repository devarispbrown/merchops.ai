'use client';

import Link from 'next/link';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function EmailIcon() {
  return (
    <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

export default function VerifyRequestPage() {
  return (
    <Card>
      <div className="text-center py-6">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <EmailIcon />
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-3">Check your email</h2>

        <p className="text-muted-foreground mb-6">
          A sign-in link has been sent to your email address.
          Click the link to complete your sign in.
        </p>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            The link will expire in 24 hours.
          </p>
          <p>
            If you don&apos;t see the email, check your spam folder.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link href="/login">
            <Button variant="secondary" fullWidth>
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
