/**
 * Request Helper Utilities
 *
 * Utilities for extracting information from requests,
 * such as client IP addresses.
 */

import { headers } from 'next/headers';

/**
 * Extract client IP address from request headers
 *
 * Checks multiple headers in order of preference:
 * 1. X-Forwarded-For (proxy/load balancer)
 * 2. X-Real-IP (nginx proxy)
 * 3. CF-Connecting-IP (Cloudflare)
 * 4. X-Client-IP (other proxies)
 *
 * For server actions, we use Next.js headers() function.
 *
 * @returns Client IP address or 'unknown' if not found
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();

  // Check X-Forwarded-For (most common)
  const xForwardedFor = headersList.get('x-forwarded-for');
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    // The first one is the original client
    const ips = xForwardedFor.split(',').map((ip) => ip.trim());
    if (ips[0]) {
      return ips[0];
    }
  }

  // Check other headers
  const xRealIp = headersList.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  const cfConnectingIp = headersList.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const xClientIp = headersList.get('x-client-ip');
  if (xClientIp) {
    return xClientIp;
  }

  // Fallback
  return 'unknown';
}
