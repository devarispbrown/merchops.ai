/**
 * MerchOps AI Prompt System - Central Registry
 *
 * Exports all prompts and maintains version registry for audit trail.
 */

export * from "./types";
export * from "./opportunity-rationale";
export * from "./discount-copy";
export * from "./winback-email";

import { discountCopyPrompt } from "./discount-copy";
import { opportunityRationalePrompt } from "./opportunity-rationale";
import type { PromptVersion } from "./types";
import { winbackEmailPrompt } from "./winback-email";

/**
 * Central prompt registry
 * Maps prompt version to prompt template
 */
export const PROMPT_REGISTRY = {
  [opportunityRationalePrompt.version]: opportunityRationalePrompt,
  [discountCopyPrompt.version]: discountCopyPrompt,
  [winbackEmailPrompt.version]: winbackEmailPrompt,
} as const;

/**
 * Get prompt template by version
 */
export function getPrompt(version: PromptVersion) {
  const prompt = PROMPT_REGISTRY[version as keyof typeof PROMPT_REGISTRY];
  if (!prompt) {
    throw new Error(`Unknown prompt version: ${version}`);
  }
  return prompt;
}

/**
 * List all available prompt versions
 */
export function listPromptVersions(): PromptVersion[] {
  return Object.keys(PROMPT_REGISTRY);
}

/**
 * Validate prompt version exists
 */
export function isValidPromptVersion(version: string): version is PromptVersion {
  return version in PROMPT_REGISTRY;
}

/**
 * Get latest version for a prompt family
 * Example: "opportunity-rationale" returns "opportunity-rationale-v1"
 */
export function getLatestVersion(promptFamily: string): PromptVersion | null {
  const versions = Object.keys(PROMPT_REGISTRY).filter((v) => v.startsWith(`${promptFamily}-v`));

  if (versions.length === 0) {
    return null;
  }

  // Sort by version number and return highest
  const sorted = versions.sort((a, b) => {
    const aNum = parseInt(a.split("-v")[1] || "0", 10);
    const bNum = parseInt(b.split("-v")[1] || "0", 10);
    return bNum - aNum;
  });

  return sorted[0] ?? null;
}
