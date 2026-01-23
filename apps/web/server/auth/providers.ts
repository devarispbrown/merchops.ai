// Authentication Providers
// Credentials provider with bcrypt password validation

import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "../db/client";
import { z } from "zod";

// Input validation schema
const credentialsSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

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
