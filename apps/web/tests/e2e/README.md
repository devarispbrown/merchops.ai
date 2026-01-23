# MerchOps E2E Test Suite

Comprehensive end-to-end test suite for MerchOps Beta MVP using Playwright.

## Test Coverage

### Critical Flows (CLAUDE.md Requirements)

All critical E2E flows from CLAUDE.md section "Testing Strategy > E2E (Playwright)" are fully covered:

1. **Shopify Connection** (`shopify-connect.spec.ts`)
   - Sign up → connect Shopify (mock) → dashboard shows queue
   - OAuth initiation and callback handling
   - Connection status display
   - Error handling

2. **Opportunity Detail** (`opportunity-flow.spec.ts`)
   - Opportunity detail shows why-now + counterfactual
   - Queue display with prioritization
   - Create draft from opportunity
   - Confidence scoring

3. **Draft Approval** (`draft-approval.spec.ts`)
   - Edit draft → approve → execution success shown
   - Field validation
   - Payload preview
   - Idempotency verification

4. **Execution Failure** (`execution-failure.spec.ts`)
   - Execution failure surfaces actionable error
   - Error codes and messages
   - Retry mechanisms
   - Provider response debugging

5. **Dismiss Flow** (`dismiss-opportunity.spec.ts`)
   - Dismiss opportunity → does not return unless input changes
   - Dismissal confirmation
   - Re-surface on material changes
   - Undo/restore functionality

## File Structure

```
tests/e2e/
├── helpers/
│   ├── auth.ts           # Authentication utilities
│   ├── mocks.ts          # Mock data and API interceptors
│   └── setup.ts          # Database seeding and cleanup
├── global-setup.ts       # Playwright global setup
├── global-teardown.ts    # Playwright global teardown
├── shopify-connect.spec.ts
├── opportunity-flow.spec.ts
├── draft-approval.spec.ts
├── execution-failure.spec.ts
└── dismiss-opportunity.spec.ts
```

## Helpers

### auth.ts
- `login(page, email, password)` - Login helper
- `signup(page, email, password, workspaceName)` - Signup helper
- `getAuthenticatedPage(context)` - Get authenticated page context
- `setupAuthState(context, sessionData)` - Setup authentication state
- `logout(page)` - Logout helper
- `isAuthenticated(page)` - Check authentication status

### mocks.ts
- Mock Shopify API responses (OAuth, shop data, products, discounts)
- Mock webhook payloads (orders, inventory, products)
- Mock opportunity data (high/medium priority)
- Mock action drafts and executions
- API interceptor setup functions

### setup.ts
- `seedTestData()` - Seed workspace, user, and Shopify connection
- `seedOpportunities()` - Seed test opportunities
- `seedEvents()` - Seed triggering events
- `seedActionDraft()` - Seed action draft
- `seedExecution()` - Seed execution records
- `seedAll()` - Seed all test data
- `cleanupWorkspace()` - Clean up workspace data
- `cleanupAll()` - Clean up all test data
- `resetDatabase()` - Reset database to clean state

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm playwright test shopify-connect.spec.ts

# Run in headed mode
pnpm playwright test --headed

# Run in debug mode
pnpm playwright test --debug

# Generate HTML report
pnpm playwright show-report
```

## Test Configuration

Configuration is in `/apps/web/playwright.config.ts`:

- Test directory: `./tests/e2e`
- Base URL: `http://localhost:3000` (configurable via `PLAYWRIGHT_TEST_BASE_URL`)
- Timeout: 60 seconds per test
- Retries: 2 on CI, 0 locally
- Screenshots: On failure
- Video: Retained on failure
- Trace: On first retry

## Global Setup/Teardown

### Global Setup (`global-setup.ts`)
1. Sets test environment variables
2. Resets test database
3. Seeds test data (workspace, user, Shopify connection, opportunities, events)
4. Verifies application is running

### Global Teardown (`global-teardown.ts`)
1. Cleans up test data
2. Disconnects from database
3. Reports summary

## Test Data

### Test User
- Email: `test@merchops.local`
- Password: `TestPassword123!`
- Workspace: `test-workspace-e2e`

### Test Shopify Store
- Domain: `test-store.myshopify.com`
- Access token: `shpat_test_token_123456789`
- Scopes: `read_products,write_products,read_orders,write_orders,read_inventory`

### Mock Opportunities
- High priority: Inventory clearance (5 units, risk of stockout)
- Medium priority: Customer win-back (127 dormant customers)

## Best Practices

1. **Isolation**: Each test is independent, using global setup/teardown
2. **Mocking**: Shopify API calls are mocked for reliability
3. **Selectors**: Use `data-testid` attributes where possible
4. **Waits**: Use `waitForLoadState` and `waitForSelector` appropriately
5. **Assertions**: Use Playwright's built-in assertions with timeouts
6. **Cleanup**: Global teardown ensures no test data persists

## Coverage Metrics

Total test files: 5 spec files + 3 helper files
Total test cases: ~70+ individual tests
Total lines of code: ~2,560 lines

### Test Distribution
- Authentication & Connection: ~10 tests
- Opportunity Flow: ~15 tests
- Draft Approval: ~12 tests
- Execution Failure: ~14 tests
- Dismiss Flow: ~13 tests

## Acceptance Criteria Coverage

All acceptance criteria from CLAUDE.md are covered:

- ✅ Sign up → connect Shopify (mock) → dashboard shows queue
- ✅ Opportunity detail shows why-now + counterfactual
- ✅ Edit draft → approve → execution success shown
- ✅ Execution failure surfaces actionable error
- ✅ Dismiss opportunity → does not return unless input changes

## CI/CD Integration

Tests are designed to run in CI with:
- Automatic retries (2x)
- Parallel execution disabled for consistency
- JSON and HTML reports generated
- Artifacts saved on failure (screenshots, videos, traces)

## Debugging

When tests fail:

1. Check screenshots in `test-results/`
2. View video recordings for failed tests
3. Use `--debug` flag for step-through debugging
4. Check HTML report: `pnpm playwright show-report`
5. Review trace files with `pnpm playwright show-trace <trace-file>`

## Contributing

When adding new E2E tests:

1. Follow existing patterns in spec files
2. Use helpers for common operations (auth, mocking)
3. Add mock data to `helpers/mocks.ts` if needed
4. Use descriptive test names with "should" prefix
5. Group related tests in `describe` blocks
6. Add `data-testid` attributes to UI components
7. Update this README with new test coverage

## Future Enhancements

Potential additions:
- Visual regression testing
- Performance testing (load times)
- Accessibility testing (axe-core)
- Mobile viewport testing
- Cross-browser testing (Firefox, Safari)
- API contract testing
