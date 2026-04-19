#!/usr/bin/env bash
# Fire Wave 1 Batch 2 — 4 Jules sessions
# Run ONLY after all Batch 1 PRs are merged to main
# Run: ./scripts/fire-wave1-batch2.sh

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
  local PROMPT="$3"

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
    echo "  ❌ Failed: $RESPONSE"
  else
    echo "  ✅ $WO_ID session: $SESSION_ID"
    echo "$WO_ID|$SESSION_ID|$TITLE|PLANNING" >> .jules-tracker.md
  fi
}

echo ""
echo "══════════════════════════════════════════════════"
echo "  ClickUp OSS — Wave 1 Batch 2 Launch"
echo "  (Batch 1 must be fully merged before running this)"
echo "══════════════════════════════════════════════════"
echo ""

fire_session "WO-002" "Identity Users" \
"Read .omc/work-orders/WO-002-identity-users.md and implement exactly what it says. Read AGENTS.md first. Create branch wave1/identity-users from main (WO-001 is now merged). Add user profile management to identity-service. Files: services/identity-service/src/users/users.handler.ts, users.service.ts, users.repository.ts. Update routes.ts. Endpoints: GET /api/v1/users/me, PATCH /api/v1/users/me, POST /api/v1/users/me/avatar (delegates to file-service), POST /api/v1/users/me/password, GET /api/v1/users/:id, GET /api/v1/users/batch?ids=. CRITICAL: NEVER expose password_hash — use toUserDto() helper. Cache user profiles in Tier 2 (60s). DataLoader for batch get. PR title: feat(WO-002): identity — user profile CRUD, avatar, password change" &

fire_session "WO-003" "Identity Workspaces" \
"Read .omc/work-orders/WO-003-identity-workspaces.md and implement exactly what it says. Read AGENTS.md first. Create branch wave1/identity-workspaces from main (WO-001 is merged). Add workspace management to identity-service. Files: services/identity-service/src/workspaces/workspaces.handler.ts, workspaces.service.ts, workspaces.repository.ts. Update routes.ts. Endpoints: POST /api/v1/workspaces, GET /api/v1/workspaces/me, GET /api/v1/workspaces/:id, PATCH /api/v1/workspaces/:id, POST /api/v1/workspaces/:id/members, DELETE /api/v1/workspaces/:id/members/:userId, PATCH /api/v1/workspaces/:id/members/:userId, GET /api/v1/workspaces/:id/members, GET /api/v1/workspaces/:id/members/:userId. CRITICAL: workspace+member creation is one atomic transaction. Cannot remove owner. Cache members in Tier 2. Publish workspace.member_added and workspace.member_removed events AFTER DB commit. PR title: feat(WO-003): identity — workspace CRUD, member management" &

fire_session "WO-004" "Identity Spaces & Lists" \
"Read .omc/work-orders/WO-004-identity-spaces-lists.md and implement exactly what it says. Read AGENTS.md first. Create branch wave1/identity-spaces-lists from main (WO-001 and WO-003 are merged). Add Spaces and Lists to identity-service. Files: services/identity-service/src/spaces/spaces.handler.ts, spaces.service.ts, spaces.repository.ts, services/identity-service/src/lists/lists.handler.ts, lists.service.ts, lists.repository.ts. Update routes.ts. CRITICAL endpoints: GET /api/v1/lists/:id must return workspaceId (task-service calls this to verify lists). On list create: seed 5 default statuses (Backlog/backlog, Todo/unstarted, In Progress/started, Done/completed, Cancelled/cancelled). Soft-delete space also soft-deletes its lists. Private spaces filter. Float position ordering. PR title: feat(WO-004): identity — spaces CRUD, lists CRUD, default status seeding" &

fire_session "WO-006" "Gateway WebSocket Hub" \
"Read .omc/work-orders/WO-006-gateway-websocket.md and implement exactly what it says. Read AGENTS.md first. Create branch wave1/gateway-websocket from main (WO-005 is merged). Add WebSocket support to api-gateway. Install: pnpm add ws && pnpm add -D @types/ws. Files: services/api-gateway/src/websocket/ws.server.ts, ws.auth.ts, ws.rooms.ts, ws.nats-bridge.ts. WebSocket server on path /ws, JWT from ?token= or Authorization header. Auto-join workspace:{id} and user:{id} on connect. Client can request join/leave for list:{id} and task:{id} rooms. NATS bridge: subscribe ALL_EVENTS, use EmitRules from @clickup/contracts to get target rooms, fan-out with deduplication (Set<WebSocket> seen). Heartbeat every 30s, terminate dead connections. Close code 4001 = Unauthorized. NOT socket.io — native ws only. PR title: feat(WO-006): api-gateway — WebSocket hub, rooms, NATS bridge, heartbeat" &

wait

echo ""
echo "══════════════════════════════════════════════════"
echo "  Batch 2 fired! Wave 1 complete when all 9 PRs merge."
echo "  Then run: ./scripts/fire-wave2.sh"
echo "══════════════════════════════════════════════════"
