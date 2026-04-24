#!/usr/bin/env bash
# E2E Smoke Test — all Wave 1 + Wave 2 services
# Requires all services running and infra up (cd infra && docker-compose up -d)
#
# Usage: ./scripts/smoke-test.sh [GATEWAY_URL]
# Default: http://localhost:3000

set -euo pipefail

GATEWAY_URL=${1:-"http://localhost:3000"}
PASS=0
FAIL=0

green()  { echo "  ✅ $1"; ((PASS++)) || true; }
red()    { echo "  ❌ $1"; ((FAIL++)) || true; }
section(){ echo ""; echo "── $1 ──"; }

check_field() {
  local label="$1"
  local value="$2"
  local field="$3"
  if [ "$value" == "null" ] || [ -z "$value" ]; then
    red "$label: $field missing"
    return 1
  fi
  return 0
}

echo "Starting smoke test against $GATEWAY_URL"

# ─────────────────────────────────────────────
section "Auth + Identity"

EMAIL="smoke-$(date +%s)@test.com"

REGISTER_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"SecurePass123!\",\"name\":\"Smoke User\"}")
TOKEN=$(echo "$REGISTER_RES" | jq -r '.data.token // empty')
USER_ID=$(echo "$REGISTER_RES" | jq -r '.data.user.id // empty')
if check_field "register" "$TOKEN" "token"; then green "register + JWT"; fi

WS_SLUG="smoke-$(date +%s)"
WS_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/workspaces" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke WS\",\"slug\":\"$WS_SLUG\"}")
WS_ID=$(echo "$WS_RES" | jq -r '.data.id // empty')
if check_field "create-workspace" "$WS_ID" "id"; then green "create workspace"; fi

SPACE_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/workspaces/$WS_ID/spaces" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Space","color":"#ff0000","isPrivate":false}')
SPACE_ID=$(echo "$SPACE_RES" | jq -r '.data.id // empty')
if check_field "create-space" "$SPACE_ID" "id"; then green "create space"; fi

LIST_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/spaces/$SPACE_ID/lists" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke List"}')
LIST_ID=$(echo "$LIST_RES" | jq -r '.data.id // empty')
if check_field "create-list" "$LIST_ID" "id"; then green "create list"; fi

# ─────────────────────────────────────────────
section "Task Service"

TASK_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"listId\":\"$LIST_ID\",\"title\":\"Smoke Task\",\"priority\":\"medium\"}")
TASK_ID=$(echo "$TASK_RES" | jq -r '.data.id // empty')
if check_field "create-task" "$TASK_ID" "id"; then green "create task"; fi

GET_TASK=$(curl -s -X GET "$GATEWAY_URL/api/v1/tasks/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN")
GOT_TITLE=$(echo "$GET_TASK" | jq -r '.data.title // empty')
if [ "$GOT_TITLE" == "Smoke Task" ]; then green "get task"; else red "get task: title mismatch"; fi

# ─────────────────────────────────────────────
section "Comment Service"

COMMENT_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/comments/tasks/$TASK_ID/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Smoke comment text"}')
COMMENT_ID=$(echo "$COMMENT_RES" | jq -r '.data.id // empty')
if check_field "create-comment" "$COMMENT_ID" "id"; then green "create comment"; fi

LIST_COMMENTS=$(curl -s "$GATEWAY_URL/api/v1/comments/tasks/$TASK_ID/comments" \
  -H "Authorization: Bearer $TOKEN")
COMMENT_COUNT=$(echo "$LIST_COMMENTS" | jq '.data | length // 0')
if [ "$COMMENT_COUNT" -ge 1 ]; then green "list comments ($COMMENT_COUNT)"; else red "list comments: empty"; fi

# ─────────────────────────────────────────────
section "Notification Service"

NOTIF_RES=$(curl -s "$GATEWAY_URL/api/v1/notifications" \
  -H "Authorization: Bearer $TOKEN")
NOTIF_OK=$(echo "$NOTIF_RES" | jq 'has("data")')
if [ "$NOTIF_OK" == "true" ]; then green "list notifications"; else red "list notifications: $NOTIF_RES"; fi

UNREAD_RES=$(curl -s "$GATEWAY_URL/api/v1/notifications/unread-count" \
  -H "Authorization: Bearer $TOKEN")
UNREAD_COUNT=$(echo "$UNREAD_RES" | jq -r '.data.count // empty')
if check_field "unread-count" "$UNREAD_COUNT" "count"; then green "unread count: $UNREAD_COUNT"; fi

# ─────────────────────────────────────────────
section "Search Service"

# Give NATS/ES a moment to index
sleep 2
SEARCH_RES=$(curl -s "$GATEWAY_URL/api/v1/search?q=Smoke&workspaceId=$WS_ID" \
  -H "Authorization: Bearer $TOKEN")
SEARCH_TOTAL=$(echo "$SEARCH_RES" | jq -r '.total // -1')
if [ "$SEARCH_TOTAL" != "-1" ]; then green "search endpoint (total: $SEARCH_TOTAL)"; else red "search: $SEARCH_RES"; fi

# ─────────────────────────────────────────────
section "Docs Service"

DOC_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/docs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"$WS_ID\",\"title\":\"Smoke Doc\",\"content\":{\"type\":\"doc\",\"content\":[]}}")
DOC_ID=$(echo "$DOC_RES" | jq -r '.data.id // empty')
if check_field "create-doc" "$DOC_ID" "id"; then green "create doc"; fi

GET_DOC=$(curl -s "$GATEWAY_URL/api/v1/docs/$DOC_ID" \
  -H "Authorization: Bearer $TOKEN")
DOC_TITLE=$(echo "$GET_DOC" | jq -r '.data.title // empty')
if [ "$DOC_TITLE" == "Smoke Doc" ]; then green "get doc"; else red "get doc: $GET_DOC"; fi

# ─────────────────────────────────────────────
section "Goals Service"

GOAL_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/goals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"$WS_ID\",\"name\":\"Smoke Goal\",\"dueDate\":\"2026-12-31T00:00:00Z\"}")
GOAL_ID=$(echo "$GOAL_RES" | jq -r '.data.id // empty')
if check_field "create-goal" "$GOAL_ID" "id"; then green "create goal"; fi

# ─────────────────────────────────────────────
section "Automations Service"

AUTO_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/automations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workspaceId\":\"$WS_ID\",
    \"name\":\"Smoke Automation\",
    \"triggerType\":\"task_created\",
    \"triggerConfig\":{},
    \"conditions\":[],
    \"actions\":[{\"type\":\"change_status\",\"config\":{\"status\":\"in_progress\"}}]
  }")
AUTO_ID=$(echo "$AUTO_RES" | jq -r '.data.id // empty')
if check_field "create-automation" "$AUTO_ID" "id"; then green "create automation"; fi

LIST_AUTOS=$(curl -s "$GATEWAY_URL/api/v1/automations/workspace/$WS_ID" \
  -H "Authorization: Bearer $TOKEN")
AUTO_COUNT=$(echo "$LIST_AUTOS" | jq '.data | length // 0')
if [ "$AUTO_COUNT" -ge 1 ]; then green "list automations ($AUTO_COUNT)"; else red "list automations: $LIST_AUTOS"; fi

# ─────────────────────────────────────────────
section "AI Service"

AI_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/ai/summarize" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workspaceId\":\"$WS_ID\",\"targetType\":\"task\",\"targetId\":\"$TASK_ID\",\"content\":\"Implement login page with OAuth\"}")
AI_OK=$(echo "$AI_RES" | jq 'has("data")')
if [ "$AI_OK" == "true" ]; then green "ai summarize"; else red "ai summarize: $AI_RES"; fi

# ─────────────────────────────────────────────
section "Health endpoints"

for svc_path in "" "/services"; do
  H=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health$svc_path")
  if [ "$H" == "200" ]; then green "GET /health$svc_path → $H"
  else red "GET /health$svc_path → $H"; fi
done

# ─────────────────────────────────────────────
echo ""
echo "── Results ──"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "All checks passed."
  exit 0
else
  echo "$FAIL check(s) failed."
  exit 1
fi
