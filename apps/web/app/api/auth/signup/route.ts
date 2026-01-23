// Signup API Route
// Creates new user with workspace and handles validation

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db/client";

// Validation schema
const signupSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .min(1, "Email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  workspaceName: z
    .string()
    .min(1, "Workspace name is required")
    .max(100, "Workspace name is too long")
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = signupSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(validated.password, saltRounds);

    // Create workspace name from email if not provided
    const workspaceName =
      validated.workspaceName ||
      `${validated.email.split("@")[0]}'s Workspace`;

    // Create user and workspace in a transaction
    // 1:1 relationship for MVP - one workspace per user
    const result = await prisma.$transaction(async (tx) => {
      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
        },
      });

      // Create user linked to workspace
      const user = await tx.user.create({
        data: {
          email: validated.email,
          password_hash: passwordHash,
          workspace_id: workspace.id,
        },
        select: {
          id: true,
          email: true,
          workspace_id: true,
          created_at: true,
        },
      });

      return { user, workspace };
    });

    // Log successful signup (exclude sensitive data)
    // Production logging would use structured logger
    // console.log(`New user signed up: ${result.user.email} (workspace: ${result.workspace.id})`);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          workspaceId: result.user.workspace_id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    // Database errors
    if (error instanceof Error) {
      console.error("Signup error:", error.message);

      // Prisma unique constraint violation
      if (error.message.includes("Unique constraint")) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 409 }
        );
      }
    }

    // Generic error
    console.error("Unexpected signup error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during signup" },
      { status: 500 }
    );
  }
}
