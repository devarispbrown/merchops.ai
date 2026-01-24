// Authentication Providers
// Credentials, Magic Link, Google, and Shopify providers

import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { Resend } from "resend";
import bcrypt from "bcryptjs";
import { prisma } from "../db/client";
import { z } from "zod";

// Input validation schema for credentials
const credentialsSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Credentials Provider - Email/Password authentication
 */
export const credentialsProvider = CredentialsProvider({
  id: "credentials",
  name: "Email and Password",
  credentials: {
    email: {
      label: "Email",
      type: "email",
      placeholder: "you@example.com",
    },
    password: {
      label: "Password",
      type: "password",
    },
  },

  async authorize(credentials) {
    try {
      // Validate input format
      const validated = credentialsSchema.parse(credentials);

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: validated.email },
        select: {
          id: true,
          email: true,
          password_hash: true,
          workspace_id: true,
        },
      });

      // User not found
      if (!user) {
        console.warn(`Login attempt for non-existent user: ${validated.email}`);
        return null;
      }

      // User signed up with OAuth (no password)
      if (!user.password_hash) {
        console.warn(`Password login attempted for OAuth user: ${validated.email}`);
        return null;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        validated.password,
        user.password_hash
      );

      if (!isValidPassword) {
        console.warn(`Invalid password attempt for user: ${validated.email}`);
        return null;
      }

      // Return user object (password_hash excluded)
      return {
        id: user.id,
        email: user.email,
        workspace_id: user.workspace_id,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error during login:", error.errors);
        return null;
      }

      console.error("Unexpected error during authentication:", error);
      return null;
    }
  },
});

/**
 * Google OAuth Provider
 */
export const googleProvider = GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  authorization: {
    params: {
      prompt: "consent",
      access_type: "offline",
      response_type: "code",
    },
  },
});

/**
 * Shopify OAuth Provider (Custom)
 * Allows users to sign in with their Shopify account
 */
export const shopifyProvider = {
  id: "shopify",
  name: "Shopify",
  type: "oauth" as const,
  authorization: {
    url: "https://accounts.shopify.com/oauth/authorize",
    params: {
      scope: "openid email profile",
      response_type: "code",
    },
  },
  token: "https://accounts.shopify.com/oauth/token",
  userinfo: "https://accounts.shopify.com/oauth/userinfo",
  clientId: process.env.SHOPIFY_AUTH_CLIENT_ID || process.env.SHOPIFY_CLIENT_ID,
  clientSecret: process.env.SHOPIFY_AUTH_CLIENT_SECRET || process.env.SHOPIFY_CLIENT_SECRET,
  profile(profile: any) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: profile.picture,
    };
  },
};

/**
 * Magic Link Email Provider (using Resend)
 * Sends a sign-in link via email
 */
export const emailProvider = {
  id: "email",
  name: "Email",
  type: "email" as const,
  maxAge: 24 * 60 * 60, // 24 hours
  async sendVerificationRequest({
    identifier: email,
    url,
  }: {
    identifier: string;
    url: string;
    provider: { from: string };
  }) {
    const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_PROVIDER_API_KEY;

    if (!apiKey) {
      console.error("Missing email provider API key for magic link");
      throw new Error("Email service not configured");
    }

    const resend = new Resend(apiKey);
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || "MerchOps <noreply@merchops.com>";

    try {
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: "Sign in to MerchOps",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Sign in to MerchOps</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #000; font-size: 24px; margin: 0;">MerchOps</h1>
              </div>

              <div style="background: #f9fafb; border-radius: 8px; padding: 30px; text-align: center;">
                <h2 style="margin-top: 0; color: #111;">Sign in to your account</h2>
                <p style="color: #666; margin-bottom: 25px;">
                  Click the button below to sign in. This link will expire in 24 hours.
                </p>
                <a href="${url}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500;">
                  Sign in to MerchOps
                </a>
              </div>

              <p style="color: #999; font-size: 13px; text-align: center; margin-top: 30px;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </body>
          </html>
        `,
        text: `Sign in to MerchOps\n\nClick the link below to sign in:\n${url}\n\nThis link will expire in 24 hours.\n\nIf you didn't request this email, you can safely ignore it.`,
      });

      console.log(`Magic link sent to ${email}`);
    } catch (error) {
      console.error("Failed to send magic link email:", error);
      throw new Error("Failed to send verification email");
    }
  },
};

/**
 * Get all enabled providers based on environment configuration
 */
export function getEnabledProviders() {
  const providers: any[] = [credentialsProvider];

  // Add Magic Link if email service is configured
  if (process.env.RESEND_API_KEY || process.env.EMAIL_PROVIDER_API_KEY) {
    providers.push(emailProvider);
  }

  // Add Google if configured
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(googleProvider);
  }

  // Add Shopify if configured (use separate auth credentials or fall back to store credentials)
  const shopifyClientId = process.env.SHOPIFY_AUTH_CLIENT_ID || process.env.SHOPIFY_CLIENT_ID;
  const shopifyClientSecret = process.env.SHOPIFY_AUTH_CLIENT_SECRET || process.env.SHOPIFY_CLIENT_SECRET;

  if (shopifyClientId && shopifyClientSecret) {
    providers.push(shopifyProvider);
  }

  return providers;
}
