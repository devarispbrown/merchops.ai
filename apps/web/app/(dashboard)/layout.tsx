import { redirect } from 'next/navigation';

import { TrialExpiringBanner } from '@/components/billing/TrialExpiringBanner';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { ToastContainer } from '@/components/ui/Toast';
import { auth } from '@/server/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <TrialExpiringBanner />
      <DashboardShell>{children}</DashboardShell>
      <ToastContainer />
    </div>
  );
}
