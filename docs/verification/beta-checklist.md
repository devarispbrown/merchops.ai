# MerchOps Beta Verification Checklist

> Reference: [CLAUDE.md](/CLAUDE.md) - Beta Verification Checklist (Scored)
> Last Updated: 2026-01-23
> Target: Beta Readiness Score >= 9.5 / 10

This checklist is executed before declaring beta. Each item is scored 0-1. If score < 9.5, continue implementing and fixing. Do not stop.

---

## Scoring Guide

| Score | Meaning |
|-------|---------|
| 0.0 | Not implemented or completely broken |
| 0.25 | Partially implemented, major issues |
| 0.5 | Implemented with significant gaps |
| 0.75 | Working with minor issues |
| 1.0 | Fully working, tested, verified |

---

## 1. First-Run Experience (1.0 points)

| Criterion | Verification Method | Evidence | Score |
|-----------|-------------------|----------|-------|
| Fresh user can sign up without assistance | E2E test: `e2e/auth/signup.spec.ts` | `[ ]` Link to test run | __ / 0.25 |
| Shopify OAuth completes on first attempt | E2E test: `e2e/shopify/oauth.spec.ts` + Manual QA with real store | `[ ]` Test + QA recording | __ / 0.25 |
| Clear empty state before data arrives | E2E test: `e2e/onboarding/empty-state.spec.ts` + Screenshot review | `[ ]` Screenshot evidence | __ / 0.25 |
| First opportunity appears within expected window | Integration test: timing validation + E2E test | `[ ]` Test metrics | __ / 0.25 |

**Section Score: __ / 1.0**

### Test Commands
```bash
# Run first-run experience tests
pnpm test:e2e --grep "first-run"
pnpm test:e2e --grep "signup"
pnpm test:e2e --grep "oauth"
```

### Manual QA Steps
1. Create new account with fresh email
2. Complete Shopify OAuth with test store
3. Verify empty state messaging is clear
4. Wait for first opportunity (record time)

---

## 2. Opportunity Quality (1.0 points)

| Criterion | Verification Method | Evidence | Score |
|-----------|-------------------|----------|-------|
| Every opportunity includes priority bucket | Unit test: `unit/opportunities/schema.test.ts` | `[ ]` Test coverage | __ / 0.15 |
| Every opportunity includes why-now explanation | Unit test + E2E visual verification | `[ ]` Test + screenshot | __ / 0.20 |
| Every opportunity includes counterfactual | Unit test + E2E visual verification | `[ ]` Test + screenshot | __ / 0.20 |
| Every opportunity includes decay behavior | Unit test: `unit/opportunities/decay.test.ts` | `[ ]` Test coverage | __ / 0.15 |
| Top opportunity feels obviously "most important" | Manual QA: stakeholder review with 3+ test scenarios | `[ ]` QA sign-off | __ / 0.15 |
| No generic or filler copy | Manual QA: content audit of 10+ opportunities | `[ ]` Audit checklist | __ / 0.15 |

**Section Score: __ / 1.0**

### Test Commands
```bash
# Run opportunity quality tests
pnpm test --grep "opportunity"
pnpm test:e2e --grep "opportunity-detail"
```

### Manual QA Steps
1. Generate 10+ opportunities from test data
2. Verify each has: priority, why-now, counterfactual, decay
3. Review copy for store-specificity (no generic text)
4. Confirm top item rationale is compelling

---

## 3. Determinism and Repeatability (1.0 points)

| Criterion | Verification Method | Evidence | Score |
|-----------|-------------------|----------|-------|
| Same inputs + same version = same opportunity output | Integration test: determinism suite | `[ ]` Test results | __ / 0.35 |
| Event replay reproduces opportunities exactly | Integration test: replay harness | `[ ]` Replay log diff | __ / 0.35 |
| No duplicate opportunities across refreshes | E2E test: refresh stability | `[ ]` Test results | __ / 0.30 |

**Section Score: __ / 1.0**

### Test Commands
```bash
# Run determinism tests
pnpm test:integration --grep "determinism"
pnpm test:integration --grep "replay"
pnpm test:e2e --grep "no-duplicates"
```

### Determinism Test Approach
```typescript
// Example test structure
describe('Opportunity Determinism', () => {
  it('produces identical output for identical inputs', async () => {
    const input = fixtures.standardEventSet;
    const result1 = await opportunityEngine.generate(input);
    const result2 = await opportunityEngine.generate(input);
    expect(result1).toDeepEqual(result2);
  });
});
```

---

## 4. Approval Safety (1.0 points)

| Criterion | Verification Method | Evidence | Score |
|-----------|-------------------|----------|-------|
| Nothing executes without explicit approval | Unit test: execution guard + E2E test | `[ ]` Test coverage | __ / 0.35 |
| Approval step shows full, accurate payload | E2E test: payload preview verification | `[ ]` Screenshot evidence | __ / 0.35 |
| Cancel/dismiss is respected permanently unless inputs change | Integration test: dismiss persistence | `[ ]` Test results | __ / 0.30 |

**Section Score: __ / 1.0**

### Test Commands
```bash
# Run approval safety tests
pnpm test --grep "approval"
pnpm test:e2e --grep "approval-flow"
pnpm test:integration --grep "dismiss"
```

### Critical Safety Checks
- [ ] Verify no code path calls execution without approval flag
- [ ] Verify payload preview matches actual execution payload
- [ ] Verify dismissed items do not reappear in queue

---

## 5. Execution Correctness (1.0 points)

| Criterion | Verification Method | Evidence | Score |
|-----------|-------------------|----------|-------|
| Idempotency keys prevent double execution | Integration test: double-submit test | `[ ]` Test results | __ / 0.25 |
| Transient failures retry safely | Integration test: failure injection | `[ ]` Test results | __ / 0.25 |
| Hard failures surface clear, actionable errors | E2E test: error UI verification | `[ ]` Screenshot evidence | __ / 0.25 |
| No partial executions observed in fault injection tests | Integration test: fault injection suite | `[ ]` Test results | __ / 0.25 |

**Section Score: __ / 1.0**

### Test Commands
```bash
# Run execution correctness tests
pnpm test:integration --grep "idempotency"
pnpm test:integration --grep "retry"
pnpm test:integration --grep "fault-injection"
pnpm test:e2e --grep "execution-error"
```

### Fault Injection Scenarios
See [failure-injection.md](./failure-injection.md) for detailed failure injection tests.

---

## 6. Learning Loop Visibility (1.0 points)

| Criterion | Verification Method | Evidence | Score |
|-----------|-------------------|----------|-------|
| Every execution resolves to helped/neutral/hurt | Integration test: outcome resolution | `[ ]` Test coverage | __ / 0.25 |
| Evidence is inspectable (metrics window, comparison logic) | E2E test: evidence UI | `[ ]` Screenshot evidence | __ / 0.25 |
| Confidence indicators update deterministically | Unit test: confidence algorithm | `[ ]` Test results | __ / 0.25 |
| Confidence never jumps erratically | Integration test: confidence stability | `[ ]` Test results | __ / 0.25 |

**Section Score: __ / 1.0**

### Test Commands
```bash
# Run learning loop tests
pnpm test --grep "outcome"
pnpm test --grep "confidence"
pnpm test:e2e --grep "learning-loop"
```

### Confidence Algorithm Verification
```typescript
// Verify confidence changes are bounded
describe('Confidence Stability', () => {
  it('confidence changes by at most X% per outcome', async () => {
    const before = await getConfidence(intentId);
    await recordOutcome(executionId, 'helped');
    const after = await getConfidence(intentId);
    expect(Math.abs(after - before)).toBeLessThan(MAX_CONFIDENCE_DELTA);
  });
});
```

---

## 7. UI Clarity and Calm (1.0 points)

| Criterion | Verification Method | Evidence | Score |
|-----------|-------------------|----------|-------|
| No cluttered screens or dense dashboards | Design review + UX audit | `[ ]` Design sign-off | __ / 0.25 |
| User always knows what has run vs pending | E2E test: status visibility | `[ ]` Screenshot evidence | __ / 0.25 |
| Queue naturally shrinks via decay and dismiss | E2E test: queue lifecycle | `[ ]` Test results | __ / 0.25 |
| No dark patterns or urgency pressure | UX audit against guardrails | `[ ]` Audit checklist | __ / 0.25 |

**Section Score: __ / 1.0**

### Test Commands
```bash
# Run UI clarity tests
pnpm test:e2e --grep "queue-status"
pnpm test:e2e --grep "queue-decay"
```

### Guardrails Checklist
- [ ] "Calm over clever" - No flashy animations or aggressive CTAs
- [ ] "Control over automation" - User actions are never implied
- [ ] "Explainability over opacity" - No black-box decisions
- [ ] "Trust compounds faster than features" - No feature overload

---

## 8. Observability and Debuggability (1.0 points)

| Criterion | Verification Method | Evidence | Score |
|-----------|-------------------|----------|-------|
| Every user-visible action traceable via logs | Integration test: log completeness | `[ ]` Log sample | __ / 0.35 |
| Correlation IDs link UI -> job -> execution | Integration test: correlation chain | `[ ]` Trace example | __ / 0.35 |
| Errors diagnosable within minutes | Incident simulation: time-to-diagnosis | `[ ]` Simulation report | __ / 0.30 |

**Section Score: __ / 1.0**

### Test Commands
```bash
# Run observability tests
pnpm test:integration --grep "logging"
pnpm test:integration --grep "correlation"
```

### Incident Simulation Protocol
1. Inject known error (see failure-injection.md)
2. Start timer
3. Use only production logs/metrics to diagnose
4. Record time-to-diagnosis
5. Target: < 5 minutes for common failures

---

## 9. Security and Isolation (1.0 points)

| Criterion | Verification Method | Evidence | Score |
|-----------|-------------------|----------|-------|
| Webhook signatures verified | Unit test: HMAC verification | `[ ]` Test coverage | __ / 0.25 |
| OAuth scopes minimal and correct | Code review: scope audit | `[ ]` Scope list | __ / 0.25 |
| No cross-workspace data access possible | Integration test: tenant isolation | `[ ]` Test results | __ / 0.25 |
| No secrets shipped to client bundles | Build audit: bundle analysis | `[ ]` Audit report | __ / 0.25 |

**Section Score: __ / 1.0**

### Test Commands
```bash
# Run security tests
pnpm test --grep "hmac"
pnpm test:integration --grep "tenant-isolation"
pnpm run audit:bundle  # Custom script to check for secrets
```

### Security Checklist
- [ ] HMAC verification for all webhooks
- [ ] Scopes: read_products, read_orders, write_price_rules (minimal)
- [ ] All DB queries include workspace_id filter
- [ ] Client bundle contains no process.env secrets
- [ ] CSRF tokens on all state-changing routes

---

## 10. Performance and Resilience (1.0 points)

| Criterion | Verification Method | Evidence | Score |
|-----------|-------------------|----------|-------|
| Dashboard loads within SLOs (< 2s warm, < 4s cold) | Performance test: Lighthouse + custom timing | `[ ]` Metrics | __ / 0.25 |
| Background jobs do not block UI | Integration test: concurrent load | `[ ]` Test results | __ / 0.25 |
| Shopify rate limits handled gracefully | Integration test: rate limit simulation | `[ ]` Test results | __ / 0.25 |
| Redis or worker restarts do not corrupt state | Chaos test: restart injection | `[ ]` Test results | __ / 0.25 |

**Section Score: __ / 1.0**

### Test Commands
```bash
# Run performance tests
pnpm test:perf
pnpm test:integration --grep "rate-limit"
pnpm test:integration --grep "resilience"
```

### SLO Verification
| Metric | Target | Actual | Pass |
|--------|--------|--------|------|
| Dashboard TTI (warm) | < 2000ms | ___ ms | [ ] |
| Dashboard TTI (cold) | < 4000ms | ___ ms | [ ] |
| Webhook ingestion p95 | < 5000ms | ___ ms | [ ] |
| Opportunity generation p95 | < 300000ms | ___ ms | [ ] |

---

## Final Score Calculation

| Section | Score |
|---------|-------|
| 1. First-Run Experience | __ / 1.0 |
| 2. Opportunity Quality | __ / 1.0 |
| 3. Determinism and Repeatability | __ / 1.0 |
| 4. Approval Safety | __ / 1.0 |
| 5. Execution Correctness | __ / 1.0 |
| 6. Learning Loop Visibility | __ / 1.0 |
| 7. UI Clarity and Calm | __ / 1.0 |
| 8. Observability and Debuggability | __ / 1.0 |
| 9. Security and Isolation | __ / 1.0 |
| 10. Performance and Resilience | __ / 1.0 |
| **TOTAL** | **__ / 10.0** |

---

## Beta Release Decision

| Score Range | Decision |
|-------------|----------|
| >= 9.5 | **SHIP** - Ready for beta |
| 9.0 - 9.4 | **HOLD** - Fix critical gaps, re-verify |
| < 9.0 | **NO GO** - Significant work remaining |

### Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product | | | |
| Engineering | | | |
| QA | | | |

---

## Appendix: Evidence Links

_Add links to test results, screenshots, and audit reports as verification is completed._

| Evidence Type | Link | Date Verified |
|--------------|------|---------------|
| CI Test Run | | |
| E2E Playwright Report | | |
| Bundle Audit Report | | |
| Performance Metrics | | |
| Security Audit | | |
| UX Review Sign-off | | |
