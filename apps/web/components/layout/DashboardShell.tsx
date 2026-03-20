'use client';

import { useState } from 'react';

import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="lg:pl-64">
        <Header onMenuToggle={() => setIsMobileMenuOpen((prev) => !prev)} />
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </>
  );
}
