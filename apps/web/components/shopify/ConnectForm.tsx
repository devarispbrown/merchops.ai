'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface ConnectFormProps {
  onSubmit: (storeDomain: string) => void;
  isLoading?: boolean;
}

export function ConnectForm({ onSubmit, isLoading = false }: ConnectFormProps) {
  const [storeDomain, setStoreDomain] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let domain = storeDomain.trim().toLowerCase();

    if (!domain) {
      setError('Please enter your store domain');
      return;
    }

    // Remove protocol if present
    domain = domain.replace(/^https?:\/\//, '');

    // Remove trailing slash
    domain = domain.replace(/\/$/, '');

    // If user entered full domain, extract subdomain
    if (domain.includes('myshopify.com')) {
      const match = domain.match(/^([a-z0-9-]+)\.myshopify\.com$/);
      if (!match) {
        setError('Please enter a valid Shopify store domain');
        return;
      }
      domain = match[1];
    }

    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(domain)) {
      setError('Store domain can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    onSubmit(domain);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="storeDomain" className="block text-sm font-medium text-foreground mb-2">
          Your Shopify Store
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="storeDomain"
            type="text"
            value={storeDomain}
            onChange={(e) => setStoreDomain(e.target.value)}
            placeholder="your-store"
            error={error}
            disabled={isLoading}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            .myshopify.com
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Enter your store&apos;s Shopify domain without the .myshopify.com suffix
        </p>
      </div>

      <Button type="submit" fullWidth disabled={isLoading}>
        {isLoading ? 'Connecting...' : 'Connect Store'}
      </Button>
    </form>
  );
}
