#!/usr/bin/env bash
# Fire Wave 1 Batch 1 — 5 Jules sessions in parallel
# Run: chmod +x scripts/fire-wave1.sh && ./scripts/fire-wave1.sh
# Requires: JULES_API_KEY env var set

set -e

REPO="Shashank2577/clickup"
BASE_BRANCH="main"
API="https://jules.googleapis.com/v1alpha/sessions"

if [ -z "$JULES_API_KEY" ]; then
  echo "❌ JULES_API_KEY not set. Run: export JULES_API_KEY=your-key"
  exit 1
fi

fire_session() {
  local WO_ID="$1"
  local TITLE="$2"
  local BRANCH="$3"
  local PROMPT="$4"

  echo "🚀 Firing $WO_ID: $TITLE"

  RESPONSE=$(curl -s -X POST "$API" \
    -H "X-Goog-Api-Key: $JULES_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"[${WO_ID}] ${TITLE}\",
      \"prompt\": $(echo "$PROMPT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
      \"sourceContext\": {
        \"source\": \"sources/github/${REPO}\",
        \"githubRepoContext\": {
          \"startingBranch\": \"${BASE_BRANCH}\"
        }
      },
      \"automationMode\": \"AUTO_CREATE_PR\"
    }")

  SESSION_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name','').split('/')[-1])" 2>/dev/null || echo "ERROR")

  if [ "$SESSION_ID" = "ERROR" ] || [ -z "$SESSION_ID" ]; then
    echo "  ❌ Failed to create session for $WO_ID"
    echo "  Response: $RESPONSE"
  else
    echo "  ✅ $WO_ID session ID: $SESSION_ID"
    echo "$WO_ID|$SESSION_ID|$TITLE|PLANNING" >> .jules-tracker.md
  fi
}

echo ""
echo "══════════════════════════════════════════════════"
echo "  ClickUp OSS — Wave 1 Batch 1 Launch"
echo "  Repo: $REPO | Base: $BASE_BRANCH"
echo "══════════════════════════════════════════════════"
echo ""

# Initialize tracker
cat > .jules-tracker.md << 'TRACKER'
# Jules Wave 1 Session Tracker

## Batch 1 — Independent (fired first)

| WO | Session ID | Title | State |
|----|-----------|-------|-------|
TRACKER

# Fire all 5 Batch 1 sessions in parallel
fire_session "WO-001" "Identity Auth" "wave1/identity-auth" \
"Read .omc/work-orders/WO-001-identity-auth.md and implement exactly what it says. Read AGENTS.md first for architecture rules. Create branch wave1/identity-auth. Implement: register (POST /api/v1/auth/register), login (POST /api/v1/auth/login), logout (POST /api/v1/auth/logout), refresh (POST /api/v1/auth/refresh), verify (GET /api/v1/auth/verify). Use bcrypt for password hashing. JWT signing via signToken from @clickup/sdk. Sessions stored in sessions table. Files: services/identity-service/src/auth/auth.handler.ts, auth.service.ts, auth.repository.ts. Also create services/identity-service/src/index.ts (copy _template, PORT=3001), routes.ts, package.json, tsconfig.json, .env.example. Add migration services/identity-service/migrations/001_add_password_hash.sql: ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT ''. All mandatory tests from WO-001 must pass. PR title: feat(WO-001): identity auth — register, login, logout, JWT, sessions" &

fire_session "WO-005" "API Gateway Routing" "wave1/gateway-routing" \
"Read .omc/work-orders/WO-005-gateway-routing.md and implement exactly what it says. Read AGENTS.md first. Create branch wave1/gateway-routing. Implement: SERVICE_ROUTES proxy config, http-proxy-middleware setup, JWT auth forwarding to identity-service /api/v1/auth/verify, x-user-id/x-workspace-id/x-role header injection, rate limiting (250 mutations/30s, 1000 reads/60s) via Redis, x-trace-id correlation ID middleware, GET /health and GET /health/services. No DB connection. Files: services/api-gateway/src/index.ts, routes.ts, proxy/proxy.config.ts, proxy/proxy.middleware.ts, middleware/rate-limiter.ts, middleware/auth-forward.ts, package.json, tsconfig.json, .env.example. Install: http-proxy-middleware express-rate-limit. PORT=3000. All mandatory tests must pass. PR title: feat(WO-005): api-gateway — routing, proxy, auth forwarding, rate limiting" &

fire_session "WO-007" "DB Seed Script" "wave1/db-seed" \
"Read .omc/work-orders/WO-007-db-seed.md and implement exactly what it says. Read AGENTS.md first. Create branch wave1/db-seed. Create: infra/seeds/seed.ts (idempotent demo seed — 1 user, 1 workspace, 2 spaces, 3 lists each, 5 statuses per list, 10 tasks per list with 3 subtasks each, 2 comments per task). Demo user: email=demo@clickup.oss, id=00000000-0000-0000-0000-000000000001, password=password123 (bcrypt hash). Use INSERT ... ON CONFLICT DO NOTHING for known UUIDs. Tasks need materialized path AND seq_id (insert into task_sequences with MAX(seq_id)+1, then UPDATE tasks SET seq_id). Also create infra/seeds/fixtures/users.fixture.ts, workspaces.fixture.ts, tasks.fixture.ts with the fixture builder functions shown in the WO. Add to root package.json: script 'seed': 'tsx infra/seeds/seed.ts'. All mandatory tests must pass. PR title: feat(WO-007): db seed script and test fixtures" &

fire_session "WO-008" "Pact Broker Setup" "wave1/pact-broker" \
"Read .omc/work-orders/WO-008-pact-broker.md and implement exactly what it says. Read AGENTS.md first. Create branch wave1/pact-broker. Create: infra/pact/docker-compose.pact.yml (Pact Broker at port 9292 with postgres sidecar, credentials pact/pact), infra/pact/README.md (instructions for local use), packages/test-helpers/src/contract-validator.ts (validateResponse and validatePaginatedResponse functions using Zod to validate entity shapes), .github/workflows/pact.yml (CI workflow for consumer pact publish and provider verification). Note: do NOT create packages/test-helpers/package.json — only create the contract-validator.ts file inside src/. All mandatory tests must pass. PR title: feat(WO-008): pact broker, contract validator, CI workflow" &

fire_session "WO-009" "Test Helpers Package" "wave1/test-helpers" \
"Read .omc/work-orders/WO-009-test-helpers.md and implement exactly what it says. Read AGENTS.md first. Create branch wave1/test-helpers. Create the full packages/test-helpers package: package.json, tsconfig.json, src/index.ts (barrel), src/db.ts (getTestDb, closeTestDb, withRollback, setupTestDb), src/auth.ts (makeTestToken using signToken from @clickup/sdk, authHeader, testAuth), src/request.ts (createTestRequest supertest factory), src/contract-validator.ts (validateResponse, validatePaginatedResponse with Zod), src/fixtures/users.fixture.ts (createTestUser — bcrypt cost 4), src/fixtures/workspaces.fixture.ts (createTestWorkspace adds owner to workspace_members, createTestSpace, createTestList seeds 3 statuses), src/fixtures/tasks.fixture.ts (createTestTask inserts task + task_sequences row with MAX(seq_id)+1 + updates tasks.seq_id, createTestComment). Register package in pnpm-workspace.yaml. This is devDependency only — never runtime. All mandatory tests must pass. PR title: feat(WO-009): test-helpers package — fixtures, auth factory, request helper" &

wait

echo ""
echo "══════════════════════════════════════════════════"
echo "  Batch 1 fired! Check status:"
echo "  curl -s 'https://jules.googleapis.com/v1alpha/sessions' \\"
echo "    -H 'X-Goog-Api-Key: \$JULES_API_KEY' | python3 -m json.tool"
echo ""
echo "  Or: ./scripts/check-wave1.sh"
echo ""
echo "  ⏱  Estimated completion: 45-90 minutes"
echo "  🔔 Fire Batch 2 only after ALL Batch 1 PRs are merged"
echo "══════════════════════════════════════════════════"
