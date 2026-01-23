# MerchOps Beta Verification Report

**Version:** 1.0.0
**Report Date:** ____________________
**Prepared By:** ____________________
**Review Period:** ____________________

---

## Executive Summary

This document serves as the official verification report for the MerchOps Beta MVP release. It provides a comprehensive assessment against all 10 verification sections defined in [CLAUDE.md](/CLAUDE.md), with detailed evidence links, scoring, and pass/fail determination.

### Beta Readiness Criteria

- **Target Score:** >= 9.5 / 10
- **Current Score:** __ / 10
- **Status:** [ ] PASS | [ ] FAIL | [ ] IN PROGRESS

---

## Table of Contents

1. [First-Run Experience](#1-first-run-experience)
2. [Opportunity Quality](#2-opportunity-quality)
3. [Determinism and Repeatability](#3-determinism-and-repeatability)
4. [Approval Safety](#4-approval-safety)
5. [Execution Correctness](#5-execution-correctness)
6. [Learning Loop Visibility](#6-learning-loop-visibility)
7. [UI Clarity and Calm](#7-ui-clarity-and-calm)
8. [Observability and Debuggability](#8-observability-and-debuggability)
9. [Security and Isolation](#9-security-and-isolation)
10. [Performance and Resilience](#10-performance-and-resilience)
11. [Final Score and Determination](#final-score-and-determination)
12. [Sign-Off](#sign-off)
13. [Appendix: Evidence Repository](#appendix-evidence-repository)

---

## Scoring Methodology

Each section is scored on a scale of 0.0 to 1.0:

| Score | Interpretation |
|-------|----------------|
| 1.0 | All criteria fully met with passing tests and evidence |
| 0.75 | Working with minor issues; acceptable for beta |
| 0.5 | Implemented with significant gaps; needs remediation |
| 0.25 | Partially implemented; major issues present |
| 0.0 | Not implemented or completely broken |

**Pass Threshold:** Each individual criterion must score >= 0.5 for the section to pass. Overall score must be >= 9.5 for beta release approval.

---

## 1. First-Run Experience

**Target:** 1.0 points
**Actual:** __ / 1.0

### Criteria Assessment

#### 1.1 Fresh User Sign-Up (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| User can sign up without assistance | [ ] | |
| Sign-up form validates input correctly | [ ] | |
| Email confirmation (if required) works | [ ] | |
| User redirected to appropriate next step | [ ] | |

**Test Evidence:**
- E2E Test: `tests/e2e/auth/signup.spec.ts`
- Test Run Link: [____________________]
- Last Verified: ____________________

**Score:** __ / 0.25

---

#### 1.2 Shopify OAuth Completion (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| OAuth handshake completes on first attempt | [ ] | |
| Correct scopes requested | [ ] | |
| Token stored securely (encrypted) | [ ] | |
| User returned to app with success state | [ ] | |
| Shopify connection status displayed correctly | [ ] | |

**Test Evidence:**
- E2E Test: `tests/e2e/shopify/oauth.spec.ts`
- Integration Test: `tests/integration/shopify/oauth.test.ts`
- Manual QA Recording: [____________________]
- Test Store Domain: ____________________
- Last Verified: ____________________

**Score:** __ / 0.25

---

#### 1.3 Clear Empty State (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Empty state UI displayed before data arrives | [ ] | |
| Clear messaging explains what will appear | [ ] | |
| No broken UI elements or loading spinners stuck | [ ] | |
| CTA guides user to next action | [ ] | |

**Test Evidence:**
- E2E Test: `tests/e2e/onboarding/empty-state.spec.ts`
- Screenshot Evidence: [____________________]
- Last Verified: ____________________

**Score:** __ / 0.25

---

#### 1.4 First Opportunity Timing (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| First opportunity appears within expected window | [ ] | |
| Timing meets SLO (< 5 minutes from triggering event p95) | [ ] | |
| Notification/indication when opportunity is ready | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/opportunities/timing.test.ts`
- Timing Metrics: [____________________]
- p95 Measurement: ____ ms
- Last Verified: ____________________

**Score:** __ / 0.25

---

### Section 1 Summary

| Criterion | Score | Status |
|-----------|-------|--------|
| 1.1 Fresh User Sign-Up | __ / 0.25 | [ ] Pass [ ] Fail |
| 1.2 Shopify OAuth | __ / 0.25 | [ ] Pass [ ] Fail |
| 1.3 Clear Empty State | __ / 0.25 | [ ] Pass [ ] Fail |
| 1.4 First Opportunity Timing | __ / 0.25 | [ ] Pass [ ] Fail |
| **Section Total** | **__ / 1.0** | |

---

## 2. Opportunity Quality

**Target:** 1.0 points
**Actual:** __ / 1.0

### Criteria Assessment

#### 2.1 Priority Bucket Present (0.15 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Every opportunity includes priority bucket | [ ] | |
| Priority bucket is one of: high, medium, low | [ ] | |
| UI displays priority clearly | [ ] | |

**Test Evidence:**
- Unit Test: `tests/unit/opportunities/schema.test.ts`
- Test Run Link: [____________________]

**Score:** __ / 0.15

---

#### 2.2 Why-Now Explanation (0.20 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Every opportunity includes why-now text | [ ] | |
| Why-now is explicit and non-generic | [ ] | |
| Why-now references store-specific data | [ ] | |
| Why-now visible in UI | [ ] | |

**Test Evidence:**
- Unit Test: `tests/unit/opportunities/why-now.test.ts`
- E2E Test: `tests/e2e/opportunities/detail.spec.ts`
- Screenshot Evidence: [____________________]

**Score:** __ / 0.20

---

#### 2.3 Counterfactual Present (0.20 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Every opportunity includes counterfactual | [ ] | |
| Counterfactual explains consequence of inaction | [ ] | |
| Counterfactual is store-specific | [ ] | |
| Counterfactual visible in UI | [ ] | |

**Test Evidence:**
- Unit Test: `tests/unit/opportunities/counterfactual.test.ts`
- E2E Test: `tests/e2e/opportunities/detail.spec.ts`
- Screenshot Evidence: [____________________]

**Score:** __ / 0.20

---

#### 2.4 Decay Behavior (0.15 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Every opportunity has decay_at timestamp | [ ] | |
| Opportunities expire or degrade at decay_at | [ ] | |
| Expired opportunities transition to expired state | [ ] | |
| Decay job runs on schedule | [ ] | |

**Test Evidence:**
- Unit Test: `tests/unit/opportunities/decay.test.ts`
- Integration Test: `tests/integration/opportunities/decay.test.ts`
- Job Schedule Verification: [____________________]

**Score:** __ / 0.15

---

#### 2.5 Top Opportunity Feels Important (0.15 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Prioritization algorithm ranks correctly | [ ] | |
| Top opportunity has compelling rationale | [ ] | |
| Stakeholder review passed (3+ scenarios) | [ ] | |

**Test Evidence:**
- Unit Test: `tests/unit/opportunities/prioritization.test.ts`
- Manual QA Sign-off: [____________________]
- Reviewer Names: ____________________
- Review Date: ____________________

**Score:** __ / 0.15

---

#### 2.6 No Generic or Filler Copy (0.15 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Rationale references specific products/data | [ ] | |
| Why-now includes specific timeframes/numbers | [ ] | |
| No placeholder or template text visible | [ ] | |
| Content audit of 10+ opportunities passed | [ ] | |

**Test Evidence:**
- Content Audit Checklist: [____________________]
- Sample Opportunities Reviewed: ____________________
- Auditor: ____________________

**Score:** __ / 0.15

---

### Section 2 Summary

| Criterion | Score | Status |
|-----------|-------|--------|
| 2.1 Priority Bucket Present | __ / 0.15 | [ ] Pass [ ] Fail |
| 2.2 Why-Now Explanation | __ / 0.20 | [ ] Pass [ ] Fail |
| 2.3 Counterfactual Present | __ / 0.20 | [ ] Pass [ ] Fail |
| 2.4 Decay Behavior | __ / 0.15 | [ ] Pass [ ] Fail |
| 2.5 Top Opportunity Importance | __ / 0.15 | [ ] Pass [ ] Fail |
| 2.6 No Generic Copy | __ / 0.15 | [ ] Pass [ ] Fail |
| **Section Total** | **__ / 1.0** | |

---

## 3. Determinism and Repeatability

**Target:** 1.0 points
**Actual:** __ / 1.0

### Criteria Assessment

#### 3.1 Same Inputs Produce Same Output (0.35 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Identical inputs + version = identical opportunity | [ ] | |
| Opportunity ID generation is deterministic | [ ] | |
| Priority calculation is deterministic | [ ] | |
| Content generation (AI fallback) is deterministic | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/opportunities/determinism.test.ts`
- Test Run Link: [____________________]

**Test Code Example:**
```typescript
// tests/integration/opportunities/determinism.test.ts
describe('Opportunity Determinism', () => {
  it('produces identical output for identical inputs', async () => {
    const events = fixtures.standardEventSet;
    const result1 = await opportunityEngine.generate(events);
    const result2 = await opportunityEngine.generate(events);
    expect(result1).toDeepEqual(result2);
  });
});
```

**Score:** __ / 0.35

---

#### 3.2 Event Replay Reproduces Opportunities (0.35 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Event replay harness exists | [ ] | |
| Replayed events produce same opportunities | [ ] | |
| Opportunity IDs match across replays | [ ] | |
| Log diff shows no differences | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/events/replay.test.ts`
- Replay Log Diff: [____________________]
- Test Run Link: [____________________]

**Score:** __ / 0.35

---

#### 3.3 No Duplicate Opportunities (0.30 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Page refresh does not create duplicates | [ ] | |
| Multiple webhook deliveries do not create duplicates | [ ] | |
| Dedupe key prevents duplicate events | [ ] | |
| Opportunity dedupe logic verified | [ ] | |

**Test Evidence:**
- E2E Test: `tests/e2e/opportunities/no-duplicates.spec.ts`
- Unit Test: `tests/unit/events/dedupe.test.ts`
- Test Run Link: [____________________]

**Score:** __ / 0.30

---

### Section 3 Summary

| Criterion | Score | Status |
|-----------|-------|--------|
| 3.1 Same Inputs = Same Output | __ / 0.35 | [ ] Pass [ ] Fail |
| 3.2 Event Replay | __ / 0.35 | [ ] Pass [ ] Fail |
| 3.3 No Duplicates | __ / 0.30 | [ ] Pass [ ] Fail |
| **Section Total** | **__ / 1.0** | |

---

## 4. Approval Safety

**Target:** 1.0 points
**Actual:** __ / 1.0

### Criteria Assessment

#### 4.1 Nothing Executes Without Approval (0.35 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Code audit confirms no auto-execution paths | [ ] | |
| Execution requires approved state on draft | [ ] | |
| Direct API calls without approval rejected | [ ] | |
| E2E test confirms approval required | [ ] | |

**Test Evidence:**
- Unit Test: `tests/unit/actions/approval-guard.test.ts`
- E2E Test: `tests/e2e/actions/approval-required.spec.ts`
- Code Audit: [____________________]

**Code Path Verification:**
```
Action Draft (state: draft)
    |
    v [user clicks Approve]
Action Draft (state: approved)
    |
    v [only then]
Execution created
```

**Score:** __ / 0.35

---

#### 4.2 Approval Shows Full Payload (0.35 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Payload preview visible before approval | [ ] | |
| Payload preview matches execution payload | [ ] | |
| All editable fields displayed | [ ] | |
| Non-editable fields visible but disabled | [ ] | |

**Test Evidence:**
- E2E Test: `tests/e2e/actions/payload-preview.spec.ts`
- Screenshot Evidence: [____________________]

**Payload Match Verification:**
```
Preview Payload Hash: ____________________
Execution Payload Hash: ____________________
Match: [ ] Yes [ ] No
```

**Score:** __ / 0.35

---

#### 4.3 Dismiss Respected Permanently (0.30 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Dismissed opportunity moves to dismissed state | [ ] | |
| Dismissed opportunity does not reappear in queue | [ ] | |
| Dismissed opportunity reappears if inputs change | [ ] | |
| "Don't show again" semantics working | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/opportunities/dismiss.test.ts`
- E2E Test: `tests/e2e/opportunities/dismiss.spec.ts`
- Test Run Link: [____________________]

**Score:** __ / 0.30

---

### Section 4 Summary

| Criterion | Score | Status |
|-----------|-------|--------|
| 4.1 Nothing Executes Without Approval | __ / 0.35 | [ ] Pass [ ] Fail |
| 4.2 Approval Shows Full Payload | __ / 0.35 | [ ] Pass [ ] Fail |
| 4.3 Dismiss Respected | __ / 0.30 | [ ] Pass [ ] Fail |
| **Section Total** | **__ / 1.0** | |

---

## 5. Execution Correctness

**Target:** 1.0 points
**Actual:** __ / 1.0

### Criteria Assessment

#### 5.1 Idempotency Keys Prevent Double Execution (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Every execution has unique idempotency key | [ ] | |
| Duplicate execution attempt is rejected/ignored | [ ] | |
| Idempotency key format is deterministic | [ ] | |
| Double-submit test passes | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/execution/idempotency.test.ts`
- Unit Test: `tests/unit/execution/idempotency-key.test.ts`
- Test Run Link: [____________________]

**Idempotency Key Format:**
```
exec:{action_draft_id}:{timestamp_ms}
Example: exec:abc123:1705322400000
```

**Score:** __ / 0.25

---

#### 5.2 Transient Failures Retry Safely (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Transient errors trigger retry | [ ] | |
| Retry uses exponential backoff | [ ] | |
| Max retry limit enforced | [ ] | |
| No duplicate side effects on retry | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/execution/retry.test.ts`
- Failure Injection Test: [____________________]

**Retry Configuration:**
```
Max Attempts: 5
Backoff Type: exponential
Initial Delay: 3000ms
```

**Score:** __ / 0.25

---

#### 5.3 Hard Failures Surface Clear Errors (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Hard failure updates execution status to failed | [ ] | |
| Error code and message stored | [ ] | |
| UI displays actionable error message | [ ] | |
| User can understand what went wrong | [ ] | |

**Test Evidence:**
- E2E Test: `tests/e2e/execution/error-display.spec.ts`
- Screenshot Evidence: [____________________]

**Sample Error Messages:**
| Error Code | User-Facing Message |
|------------|---------------------|
| SHOPIFY_RATE_LIMIT | "Shopify is temporarily unavailable. Your action will retry automatically." |
| INVALID_DISCOUNT_CODE | "The discount code 'XYZ' already exists. Please choose a different code." |
| PRODUCT_NOT_FOUND | "The selected product could not be found. It may have been deleted." |

**Score:** __ / 0.25

---

#### 5.4 No Partial Executions (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Execution is atomic (all or nothing) | [ ] | |
| Fault injection does not leave partial state | [ ] | |
| Transaction rollback on failure | [ ] | |
| State audit after fault injection passes | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/execution/atomicity.test.ts`
- Fault Injection Test: `tests/integration/execution/fault-injection.test.ts`
- Test Run Link: [____________________]

**Fault Injection Scenarios Tested:**
- [ ] Network failure mid-execution
- [ ] Database connection lost
- [ ] Shopify API timeout
- [ ] Worker crash mid-job

**Score:** __ / 0.25

---

### Section 5 Summary

| Criterion | Score | Status |
|-----------|-------|--------|
| 5.1 Idempotency Keys | __ / 0.25 | [ ] Pass [ ] Fail |
| 5.2 Transient Failure Retry | __ / 0.25 | [ ] Pass [ ] Fail |
| 5.3 Hard Failure Errors | __ / 0.25 | [ ] Pass [ ] Fail |
| 5.4 No Partial Executions | __ / 0.25 | [ ] Pass [ ] Fail |
| **Section Total** | **__ / 1.0** | |

---

## 6. Learning Loop Visibility

**Target:** 1.0 points
**Actual:** __ / 1.0

### Criteria Assessment

#### 6.1 Every Execution Resolves to Outcome (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Outcome computed for all successful executions | [ ] | |
| Outcome is one of: helped, neutral, hurt | [ ] | |
| Outcome computation runs on schedule | [ ] | |
| No executions left without outcomes after window | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/outcomes/resolution.test.ts`
- Scheduler Config Verification: [____________________]

**Outcome Computation Schedule:**
```
Pattern: 0 2 * * * (Daily at 2 AM)
Lookback Window: 7 days
```

**Score:** __ / 0.25

---

#### 6.2 Evidence is Inspectable (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| evidence_json stored with outcome | [ ] | |
| UI displays evidence metrics | [ ] | |
| Comparison logic visible to user | [ ] | |
| Metrics window displayed (baseline vs actual) | [ ] | |

**Test Evidence:**
- E2E Test: `tests/e2e/outcomes/evidence-display.spec.ts`
- Screenshot Evidence: [____________________]

**Evidence JSON Example:**
```json
{
  "baseline_period": "2024-01-01 to 2024-01-07",
  "measurement_period": "2024-01-08 to 2024-01-14",
  "baseline_conversion_rate": 0.023,
  "actual_conversion_rate": 0.031,
  "uplift_percentage": 34.8,
  "sample_size": 1250,
  "confidence_interval": [0.028, 0.034]
}
```

**Score:** __ / 0.25

---

#### 6.3 Confidence Indicators Update Deterministically (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Confidence score exists per operator intent | [ ] | |
| Confidence changes on outcome recording | [ ] | |
| Change follows deterministic formula | [ ] | |
| Same outcomes produce same confidence change | [ ] | |

**Test Evidence:**
- Unit Test: `tests/unit/learning/confidence.test.ts`
- Integration Test: `tests/integration/learning/confidence-update.test.ts`

**Confidence Algorithm:**
```
new_confidence = old_confidence + (weight * outcome_signal)

Where:
- outcome_signal = +0.1 (helped), 0 (neutral), -0.1 (hurt)
- weight = decay_factor * recency_factor
```

**Score:** __ / 0.25

---

#### 6.4 Confidence Never Jumps Erratically (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Confidence change bounded (max delta) | [ ] | |
| No single outcome moves confidence > X% | [ ] | |
| Edge cases tested (many outcomes at once) | [ ] | |
| Historical confidence graph is smooth | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/learning/confidence-stability.test.ts`
- Max Delta Verification: [____________________]

**Stability Parameters:**
```
MAX_CONFIDENCE_DELTA = 0.05 (5%)
MIN_CONFIDENCE = 0.1
MAX_CONFIDENCE = 0.95
```

**Score:** __ / 0.25

---

### Section 6 Summary

| Criterion | Score | Status |
|-----------|-------|--------|
| 6.1 Every Execution Resolves | __ / 0.25 | [ ] Pass [ ] Fail |
| 6.2 Evidence Inspectable | __ / 0.25 | [ ] Pass [ ] Fail |
| 6.3 Confidence Updates Deterministically | __ / 0.25 | [ ] Pass [ ] Fail |
| 6.4 Confidence Stability | __ / 0.25 | [ ] Pass [ ] Fail |
| **Section Total** | **__ / 1.0** | |

---

## 7. UI Clarity and Calm

**Target:** 1.0 points
**Actual:** __ / 1.0

### Criteria Assessment

#### 7.1 No Cluttered Screens (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Dashboard has clear visual hierarchy | [ ] | |
| Information density is appropriate | [ ] | |
| White space used effectively | [ ] | |
| Design review passed | [ ] | |

**Test Evidence:**
- Design Review Sign-off: [____________________]
- Screenshot Evidence: [____________________]
- Reviewer: ____________________
- Review Date: ____________________

**Score:** __ / 0.25

---

#### 7.2 User Knows Run vs Pending Status (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Pending actions clearly marked | [ ] | |
| Executed actions visually distinct | [ ] | |
| Execution history accessible | [ ] | |
| Status labels are unambiguous | [ ] | |

**Test Evidence:**
- E2E Test: `tests/e2e/queue/status-visibility.spec.ts`
- Screenshot Evidence: [____________________]

**Status Labels:**
| State | Label | Visual Indicator |
|-------|-------|------------------|
| draft | "Ready to Review" | Blue badge |
| approved | "Pending Execution" | Yellow badge |
| executed | "Completed" | Green badge |
| failed | "Failed" | Red badge |

**Score:** __ / 0.25

---

#### 7.3 Queue Shrinks Via Decay and Dismiss (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Expired opportunities removed from queue | [ ] | |
| Dismissed opportunities removed from queue | [ ] | |
| Queue count decreases over time naturally | [ ] | |
| No stale items accumulating | [ ] | |

**Test Evidence:**
- E2E Test: `tests/e2e/queue/lifecycle.spec.ts`
- Integration Test: `tests/integration/opportunities/queue-cleanup.test.ts`

**Queue Cleanup Verification:**
```
Initial Queue Size: ____
After 24h Decay: ____
After Dismiss Actions: ____
```

**Score:** __ / 0.25

---

#### 7.4 No Dark Patterns or Urgency Pressure (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| No countdown timers creating false urgency | [ ] | |
| No manipulative copy ("Act now or lose...") | [ ] | |
| Dismiss is easy and guilt-free | [ ] | |
| UX audit against guardrails passed | [ ] | |

**Test Evidence:**
- UX Audit Checklist: [____________________]
- Auditor: ____________________

**Guardrails Verification:**
- [ ] "Calm over clever" - No flashy animations
- [ ] "Control over automation" - Actions never implied
- [ ] "Explainability over opacity" - No black-box decisions
- [ ] "Trust compounds faster than features" - No feature overload

**Score:** __ / 0.25

---

### Section 7 Summary

| Criterion | Score | Status |
|-----------|-------|--------|
| 7.1 No Cluttered Screens | __ / 0.25 | [ ] Pass [ ] Fail |
| 7.2 Run vs Pending Status Clear | __ / 0.25 | [ ] Pass [ ] Fail |
| 7.3 Queue Shrinks Naturally | __ / 0.25 | [ ] Pass [ ] Fail |
| 7.4 No Dark Patterns | __ / 0.25 | [ ] Pass [ ] Fail |
| **Section Total** | **__ / 1.0** | |

---

## 8. Observability and Debuggability

**Target:** 1.0 points
**Actual:** __ / 1.0

### Criteria Assessment

#### 8.1 Every Action Traceable Via Logs (0.35 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| All user actions logged | [ ] | |
| All background jobs logged | [ ] | |
| All API calls logged | [ ] | |
| Logs include sufficient context | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/logging/completeness.test.ts`
- Sample Log Entry: [____________________]

**Log Entry Example:**
```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.000Z",
  "correlationId": "req_abc123",
  "workspaceId": "ws_xyz789",
  "userId": "usr_def456",
  "action": "opportunity.approve",
  "opportunityId": "opp_123",
  "draftId": "draft_456",
  "msg": "Opportunity approved for execution"
}
```

**Score:** __ / 0.35

---

#### 8.2 Correlation IDs Link UI to Execution (0.35 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Request receives correlation ID | [ ] | |
| Correlation ID passed to background jobs | [ ] | |
| Correlation ID appears in execution logs | [ ] | |
| Full trace reconstructable from ID | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/logging/correlation.test.ts`
- Trace Example: [____________________]

**Correlation Chain Verification:**
```
1. API Request: correlationId = req_abc123
2. Queue Job: correlationId = req_abc123
3. Worker Log: correlationId = req_abc123
4. Execution Record: correlationId = req_abc123
5. Outcome Log: correlationId = req_abc123
```

**Score:** __ / 0.35

---

#### 8.3 Errors Diagnosable Within Minutes (0.30 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Incident simulation completed | [ ] | |
| Time-to-diagnosis measured | [ ] | |
| Root cause identifiable from logs alone | [ ] | |
| Target: < 5 minutes for common failures | [ ] | |

**Test Evidence:**
- Incident Simulation Report: [____________________]
- Simulation Date: ____________________

**Incident Simulation Results:**
| Failure Scenario | Time to Diagnose | Target | Pass |
|-----------------|------------------|--------|------|
| Database connection error | ____ min | < 5 min | [ ] |
| Redis timeout | ____ min | < 5 min | [ ] |
| Shopify API rate limit | ____ min | < 5 min | [ ] |
| Worker crash | ____ min | < 5 min | [ ] |

**Score:** __ / 0.30

---

### Section 8 Summary

| Criterion | Score | Status |
|-----------|-------|--------|
| 8.1 Actions Traceable | __ / 0.35 | [ ] Pass [ ] Fail |
| 8.2 Correlation IDs | __ / 0.35 | [ ] Pass [ ] Fail |
| 8.3 Errors Diagnosable | __ / 0.30 | [ ] Pass [ ] Fail |
| **Section Total** | **__ / 1.0** | |

---

## 9. Security and Isolation

**Target:** 1.0 points
**Actual:** __ / 1.0

### Criteria Assessment

#### 9.1 Webhook Signatures Verified (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| HMAC verification implemented | [ ] | |
| Invalid signatures rejected with 401 | [ ] | |
| Timing-safe comparison used | [ ] | |
| Webhook secret stored securely | [ ] | |

**Test Evidence:**
- Unit Test: `tests/unit/shopify/hmac.test.ts`
- Integration Test: `tests/integration/shopify/webhook-verification.test.ts`

**HMAC Verification Code Location:**
```
File: apps/web/server/shopify/webhooks.ts
Function: verifyWebhookSignature()
```

**Score:** __ / 0.25

---

#### 9.2 OAuth Scopes Minimal and Correct (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Only required scopes requested | [ ] | |
| No read scopes where write not needed | [ ] | |
| Scope audit completed | [ ] | |
| Least privilege principle followed | [ ] | |

**Test Evidence:**
- Code Review: [____________________]
- Scope Audit Document: [____________________]

**Current Scopes:**
```
read_products
write_products (for pause action)
read_orders
read_customers
read_inventory
write_inventory
write_discounts
read_price_rules
write_price_rules
```

**Scope Justification:**
| Scope | Justification |
|-------|---------------|
| read_products | Needed for opportunity detection |
| write_products | Needed for pause product action |
| read_orders | Needed for velocity spike detection |
| read_customers | Needed for customer inactivity detection |
| read_inventory | Needed for inventory threshold detection |
| write_inventory | Needed for inventory actions |
| write_discounts | Needed for discount creation |
| read_price_rules | Needed to check existing rules |
| write_price_rules | Needed for discount creation |

**Score:** __ / 0.25

---

#### 9.3 No Cross-Workspace Data Access (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| All DB queries include workspace_id | [ ] | |
| Tenant isolation tests pass | [ ] | |
| No user can access other workspace data | [ ] | |
| API endpoints enforce workspace scope | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/security/tenant-isolation.test.ts`
- Code Review: [____________________]

**Isolation Test Scenarios:**
- [ ] User A cannot read User B's opportunities
- [ ] User A cannot read User B's executions
- [ ] User A cannot read User B's events
- [ ] API endpoint rejects cross-workspace requests
- [ ] Webhook handler validates workspace_id

**Score:** __ / 0.25

---

#### 9.4 No Secrets in Client Bundles (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Bundle audit completed | [ ] | |
| No process.env secrets in client | [ ] | |
| NEXT_PUBLIC_ prefix used correctly | [ ] | |
| Source map review passed | [ ] | |

**Test Evidence:**
- Bundle Audit Script: `scripts/audit-bundle.sh`
- Audit Report: [____________________]

**Bundle Audit Commands:**
```bash
# Build production bundle
pnpm build

# Search for potential secrets
grep -r "sk_" .next/static/
grep -r "secret" .next/static/
grep -r "password" .next/static/
grep -r "DATABASE_URL" .next/static/
grep -r "REDIS_URL" .next/static/
```

**Audit Results:**
- [ ] No API keys found
- [ ] No database URLs found
- [ ] No authentication secrets found
- [ ] No OAuth secrets found

**Score:** __ / 0.25

---

### Section 9 Summary

| Criterion | Score | Status |
|-----------|-------|--------|
| 9.1 Webhook Signatures | __ / 0.25 | [ ] Pass [ ] Fail |
| 9.2 OAuth Scopes | __ / 0.25 | [ ] Pass [ ] Fail |
| 9.3 Tenant Isolation | __ / 0.25 | [ ] Pass [ ] Fail |
| 9.4 No Client Secrets | __ / 0.25 | [ ] Pass [ ] Fail |
| **Section Total** | **__ / 1.0** | |

---

## 10. Performance and Resilience

**Target:** 1.0 points
**Actual:** __ / 1.0

### Criteria Assessment

#### 10.1 Dashboard Loads Within SLOs (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Dashboard TTI < 2s (warm) | [ ] | |
| Dashboard TTI < 4s (cold) | [ ] | |
| Lighthouse performance score >= 80 | [ ] | |
| Core Web Vitals pass | [ ] | |

**Test Evidence:**
- Performance Test: `tests/perf/dashboard.test.ts`
- Lighthouse Report: [____________________]

**Performance Metrics:**
| Metric | Target | Actual | Pass |
|--------|--------|--------|------|
| TTI (warm) | < 2000ms | ____ ms | [ ] |
| TTI (cold) | < 4000ms | ____ ms | [ ] |
| LCP | < 2500ms | ____ ms | [ ] |
| FID | < 100ms | ____ ms | [ ] |
| CLS | < 0.1 | ____ | [ ] |

**Score:** __ / 0.25

---

#### 10.2 Background Jobs Do Not Block UI (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| UI remains responsive during job processing | [ ] | |
| API endpoints respond normally during load | [ ] | |
| Concurrent job processing tested | [ ] | |
| No UI freezes observed | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/jobs/non-blocking.test.ts`
- Load Test Results: [____________________]

**Concurrent Load Test:**
```
Job Count: 100 concurrent jobs
UI Response Time During Load: ____ ms
API Response Time During Load: ____ ms
Target: No degradation > 50%
```

**Score:** __ / 0.25

---

#### 10.3 Shopify Rate Limits Handled Gracefully (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Rate limit detection implemented | [ ] | |
| Automatic retry with backoff | [ ] | |
| User notified of rate limit (if applicable) | [ ] | |
| No data loss during rate limiting | [ ] | |

**Test Evidence:**
- Integration Test: `tests/integration/shopify/rate-limit.test.ts`
- Rate Limit Simulation: [____________________]

**Rate Limit Handling:**
```
Detection: X-Shopify-Shop-Api-Call-Limit header
Threshold: 80% of limit triggers throttling
Retry Strategy: Exponential backoff with jitter
Max Wait: 60 seconds
```

**Score:** __ / 0.25

---

#### 10.4 Redis/Worker Restarts Do Not Corrupt State (0.25 points)

| Requirement | Met | Evidence |
|-------------|-----|----------|
| Redis restart simulation passed | [ ] | |
| Worker restart simulation passed | [ ] | |
| No job data lost on restart | [ ] | |
| Jobs resume after restart | [ ] | |
| No duplicate processing after restart | [ ] | |

**Test Evidence:**
- Chaos Test: `tests/integration/resilience/restart.test.ts`
- Restart Simulation Report: [____________________]

**Restart Scenarios Tested:**
| Scenario | Data Loss | Duplicate Processing | Pass |
|----------|-----------|---------------------|------|
| Redis restart (graceful) | [ ] None | [ ] None | [ ] |
| Redis restart (kill -9) | [ ] None | [ ] None | [ ] |
| Worker restart (graceful) | [ ] None | [ ] None | [ ] |
| Worker restart (kill -9) | [ ] None | [ ] None | [ ] |

**Score:** __ / 0.25

---

### Section 10 Summary

| Criterion | Score | Status |
|-----------|-------|--------|
| 10.1 Dashboard SLOs | __ / 0.25 | [ ] Pass [ ] Fail |
| 10.2 Jobs Non-Blocking | __ / 0.25 | [ ] Pass [ ] Fail |
| 10.3 Rate Limit Handling | __ / 0.25 | [ ] Pass [ ] Fail |
| 10.4 Restart Resilience | __ / 0.25 | [ ] Pass [ ] Fail |
| **Section Total** | **__ / 1.0** | |

---

## Final Score and Determination

### Score Summary

| Section | Score | Weight | Status |
|---------|-------|--------|--------|
| 1. First-Run Experience | __ / 1.0 | 10% | [ ] Pass [ ] Fail |
| 2. Opportunity Quality | __ / 1.0 | 10% | [ ] Pass [ ] Fail |
| 3. Determinism and Repeatability | __ / 1.0 | 10% | [ ] Pass [ ] Fail |
| 4. Approval Safety | __ / 1.0 | 10% | [ ] Pass [ ] Fail |
| 5. Execution Correctness | __ / 1.0 | 10% | [ ] Pass [ ] Fail |
| 6. Learning Loop Visibility | __ / 1.0 | 10% | [ ] Pass [ ] Fail |
| 7. UI Clarity and Calm | __ / 1.0 | 10% | [ ] Pass [ ] Fail |
| 8. Observability and Debuggability | __ / 1.0 | 10% | [ ] Pass [ ] Fail |
| 9. Security and Isolation | __ / 1.0 | 10% | [ ] Pass [ ] Fail |
| 10. Performance and Resilience | __ / 1.0 | 10% | [ ] Pass [ ] Fail |
| **TOTAL** | **__ / 10.0** | **100%** | |

---

### Beta Release Determination

| Score Range | Decision | Action |
|-------------|----------|--------|
| >= 9.5 | **SHIP** | Ready for beta release |
| 9.0 - 9.4 | **HOLD** | Fix critical gaps, re-verify within 1 week |
| < 9.0 | **NO GO** | Significant work remaining, re-schedule verification |

**Current Score:** __ / 10.0

**Determination:** [ ] SHIP | [ ] HOLD | [ ] NO GO

---

### Gaps and Remediation Plan

If score < 9.5, document gaps and remediation:

| Gap | Section | Current | Target | Owner | ETA |
|-----|---------|---------|--------|-------|-----|
| | | | | | |
| | | | | | |
| | | | | | |

---

## Sign-Off

### Verification Team Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Product Lead** | | | |
| **Engineering Lead** | | | |
| **QA Lead** | | | |
| **Security Lead** | | | |
| **DevOps Lead** | | | |

### Release Approval

- [ ] All sections scored >= 0.5
- [ ] Total score >= 9.5
- [ ] No critical blockers identified
- [ ] Rollback plan documented
- [ ] On-call schedule confirmed
- [ ] Customer communication prepared

**Approved for Beta Release:** [ ] Yes | [ ] No

**Approver:** ____________________
**Date:** ____________________

---

## Appendix: Evidence Repository

### Test Run Evidence

| Evidence Type | Link | Date Generated |
|--------------|------|----------------|
| CI Pipeline Run | | |
| Unit Test Results | | |
| Integration Test Results | | |
| E2E Playwright Report | | |
| Performance Test Results | | |

### Audit Evidence

| Evidence Type | Link | Date Generated |
|--------------|------|----------------|
| Bundle Security Audit | | |
| OAuth Scope Audit | | |
| Tenant Isolation Audit | | |
| OWASP Checklist | | |

### QA Evidence

| Evidence Type | Link | Date Generated |
|--------------|------|----------------|
| UX Review Sign-off | | |
| Content Audit Checklist | | |
| Manual QA Test Cases | | |
| Stakeholder Review Notes | | |

### Screenshots and Recordings

| Evidence Type | Link | Date Generated |
|--------------|------|----------------|
| First-Run Experience | | |
| Opportunity Detail View | | |
| Approval Flow | | |
| Execution History | | |
| Empty States | | |
| Error States | | |

---

**End of Beta Verification Report**
