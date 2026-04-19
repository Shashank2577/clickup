#!/usr/bin/env bash
# Fire Wave 2 Batch 1 — 5 Jules sessions
# Run ONLY after all Wave 1 PRs are merged to main
# Run: export JULES_API_KEY="..." && ./scripts/fire-wave2-batch1.sh

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
    echo "❌ Failed to fire $WO_ID"
    echo "$RESPONSE"
    return 1
  fi

  echo "✅ $WO_ID fired — session: $SESSION_ID"
  echo "$WO_ID=$SESSION_ID" >> .wave2-batch1-sessions.env
}

echo "" > .wave2-batch1-sessions.env

# ── Task Service ─────────────────────────────────────────────────────────────
fire_session "WO-TS" "task-service — tasks, subtasks, checklists, tags, watchers, relations" \
"Read the work order at .omc/work-orders/WO-005-task-service.md and implement it completely on branch wave2/task-service. Follow every instruction, SQL query, and constraint exactly. Create a PR when done with title: 'feat(WO-TS): task-service — tasks, hierarchy, checklists, events'"

# ── Comment Service ───────────────────────────────────────────────────────────
fire_session "WO-010" "comment-service — comments, reactions, NATS subscriber" \
"Read the work order at .omc/work-orders/WO-010-comment-service.md and implement it completely on branch wave2/comment-service. Follow every instruction, SQL query, and constraint exactly. Create a PR when done with title: 'feat(WO-010): comment-service — threaded comments, reactions, NATS'"

# ── File Service ──────────────────────────────────────────────────────────────
fire_session "WO-011" "file-service — MinIO uploads, presigned URLs" \
"Read the work order at .omc/work-orders/WO-011-file-service.md and implement it completely on branch wave2/file-service. Follow every instruction, SQL query, and constraint exactly. Create a PR when done with title: 'feat(WO-011): file-service — MinIO uploads, presigned download URLs'"

# ── Notification Service ──────────────────────────────────────────────────────
fire_session "WO-012" "notification-service — in-app notifications, NATS subscribers" \
"Read the work order at .omc/work-orders/WO-012-notification-service.md and implement it completely on branch wave2/notification-service. Follow every instruction, SQL query, and constraint exactly. Create a PR when done with title: 'feat(WO-012): notification-service — in-app notifications via NATS'"

# ── AI Service Infrastructure ──────────────────────────────────────────────────
fire_session "WO-025" "ai-service infrastructure — Claude client, retry, rate limiting" \
"Read the work order at .omc/work-orders/WO-025-ai-infrastructure.md and implement it completely on branch wave2/ai-infrastructure. Follow every instruction exactly. Create a PR when done with title: 'feat(WO-025): ai-service — Claude client infrastructure, retry, rate limiting'"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Wave 2 Batch 1 fired — 5 sessions"
echo "Session IDs saved to .wave2-batch1-sessions.env"
echo ""
cat .wave2-batch1-sessions.env
echo "═══════════════════════════════════════════════════════"
