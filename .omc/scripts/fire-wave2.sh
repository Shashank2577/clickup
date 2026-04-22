#!/usr/bin/env bash
# Wave 2 Batch Firing Script — ClickUp OSS
# Usage: JULES_API_KEY="AIza..." JULES_ACCOUNT="account-1" bash .omc/scripts/fire-wave2.sh [1|2]
# Batch 1 = task, comment, docs, file, notification (5 sessions)
# Batch 2 = search, goal, ai-capabilities (3 sessions)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TRACKER="$REPO_ROOT/.jules-tracker.md"
WO_DIR="$REPO_ROOT/.omc/work-orders"

REPO="Shashank2577/clickup"
BASE_BRANCH="main"
BATCH="${1:-1}"

# ── Validate ──────────────────────────────────────────────────────────────────
if [[ -z "${JULES_API_KEY:-}" ]]; then
  echo "ERROR: JULES_API_KEY is not set."
  echo "  export JULES_API_KEY=\$JULES_API_KEY_1   # account-1"
  echo "  export JULES_API_KEY=\$JULES_API_KEY_2   # account-2"
  exit 1
fi

JULES_ACCOUNT="${JULES_ACCOUNT:-account-1}"
echo "Account : $JULES_ACCOUNT"
echo "Repo    : $REPO"
echo "Branch  : $BASE_BRANCH"
echo "Batch   : $BATCH"
echo ""

# ── Initialise tracker ────────────────────────────────────────────────────────
if [[ ! -f "$TRACKER" ]] || ! grep -q "^| WO" "$TRACKER"; then
  cat >> "$TRACKER" <<'EOF'

| WO | Account | Session ID | Session URL | Branch (auto) | PR | Status | Created |
|----|---------|-----------|-------------|---------------|----|--------|---------|
EOF
fi

# ── 4-Phase Protocol (injected into every prompt) ─────────────────────────────
read -r -d '' PROTOCOL << 'PROTOCOL_EOF' || true
# HIGH-RELIABILITY AUTONOMOUS PROTOCOL

## Phase 1: Spec & Plan
- Read the Work Order and AGENTS.md fully before writing a single line of code.
- Create a .jules/ directory in the repo root. Create .jules/SPEC.md and .jules/PLAN.md (file-level plan listing every file to be created or modified).
- GATE: Commit these two files immediately before writing any application code.
- Jules creates its own feature branch — do NOT ask about or wait for branch name instructions.

## Phase 2: Autonomous Implementation (Atomic Commits)
- Follow the plan and project architecture rules from AGENTS.md exactly.
- RULE: Atomic commits — one commit per 2-3 files created/modified.
- RULE: Maintain .jules/IMPLEMENTATION_LOG.md as you build.
- Do NOT stop for feedback. Make reasonable assumptions and document them in the log.

## Phase 3: Verification & Hardening
- Run: pnpm --filter=<service-name> typecheck && pnpm --filter=<service-name> test
- RULE: Fix ALL failing tests autonomously. Do not open a PR with red CI.
- Create .jules/VERIFICATION_REPORT.md with command output and any deviations.

## Phase 4: Handoff & PR
- Create .jules/HANDOFF.md summarising: what was built, deviations from spec, how reviewer can verify.
- Open a PR. Title format: feat(WO-XXX): [short description]
- Link to .jules/HANDOFF.md in the PR description.
PROTOCOL_EOF

# ── fire_session ──────────────────────────────────────────────────────────────
fire_session() {
  local WO="$1"        # e.g. WO-010
  local TITLE="$2"     # e.g. [WO-010] task-service core
  local WO_FILE="$3"   # relative to REPO_ROOT

  echo "── Firing $WO: $TITLE ──"

  local AGENTS_CONTENT WO_CONTENT
  AGENTS_CONTENT=$(cat "$REPO_ROOT/AGENTS.md")
  WO_CONTENT=$(cat "$REPO_ROOT/$WO_FILE")

  RECENT_COMMITS=$(git -C "$REPO_ROOT" log --oneline -5 | tr '\n' '; ')
  RECENT_FILES=$(git -C "$REPO_ROOT" diff --name-only HEAD~3 2>/dev/null | head -15 | tr '\n' ', ')

  local FULL_PROMPT
  FULL_PROMPT=$(cat <<PROMPT_EOF
# MISSION
You are an autonomous senior software engineer. Your mission is to implement the work order below using the HIGH-RELIABILITY AUTONOMOUS PROTOCOL. Do not stop for feedback, approval, or clarification at any point.

# PROJECT RULES (AGENTS.md)
$AGENTS_CONTENT

# THE WORK ORDER
$WO_CONTENT

# REPO CONTEXT
Repo: $REPO
Base branch: $BASE_BRANCH
Recent commits: $RECENT_COMMITS
Recently changed files: $RECENT_FILES

$PROTOCOL

# EXECUTION MODE
WORK FULLY AUTONOMOUSLY. Do not stop for approval or feedback at any point. Document all decisions in .jules/. If you hit a blocker, resolve it autonomously or pivot to a documented alternative. Complete Phases 1 through 4 in order, commit after each phase gate, then open the PR.
PROMPT_EOF
)

  local PAYLOAD
  PAYLOAD=$(python3 -c "
import json, sys
prompt = sys.stdin.read()
print(json.dumps({
  'title': '$TITLE',
  'prompt': prompt,
  'sourceContext': {
    'source': 'sources/github/$REPO',
    'githubRepoContext': {
      'startingBranch': '$BASE_BRANCH'
    }
  },
  'automationMode': 'AUTO_CREATE_PR',
  'requirePlanApproval': False
}))
" <<< "$FULL_PROMPT")

  local RESPONSE
  RESPONSE=$(curl -s -X POST 'https://jules.googleapis.com/v1alpha/sessions' \
    -H "X-Goog-Api-Key: $JULES_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  # Check for API error
  if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'id' in d else 1)" 2>/dev/null; then
    SESSION_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
    SESSION_URL=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url','—'))")
    SESSION_STATE=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','QUEUED'))")
    echo "  Session ID : $SESSION_ID"
    echo "  URL        : $SESSION_URL"
    echo "  State      : $SESSION_STATE"
    echo "| $WO | $JULES_ACCOUNT | $SESSION_ID | $SESSION_URL | (auto) | — | $SESSION_STATE | $(date +%Y-%m-%d) |" >> "$TRACKER"
    echo "  ✅ Fired → tracker updated"
  else
    echo "  ❌ ERROR firing $WO:"
    echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error', d))" 2>/dev/null || echo "$RESPONSE"
  fi
  echo ""
}

# ── Batch definitions ─────────────────────────────────────────────────────────
fire_batch1() {
  echo "════════════════════════════════════════"
  echo "  Wave 2 — Batch 1 (5 sessions)"
  echo "════════════════════════════════════════"
  echo ""

  fire_session "WO-010" "[WO-010] task-service core" ".omc/work-orders/WO-005-task-service.md"
  fire_session "WO-020" "[WO-020] comment-service core" ".omc/work-orders/WO-010-comment-service.md"
  fire_session "WO-022" "[WO-022] docs-service core" ".omc/work-orders/WO-022-docs-core.md"
  fire_session "WO-030" "[WO-030] file-service core" ".omc/work-orders/WO-011-file-service.md"
  fire_session "WO-033" "[WO-033] notification-service core" ".omc/work-orders/WO-012-notification-service.md"

  echo "════════════════════════════════════════"
  echo "  Batch 1 done. Monitor at:"
  echo "  https://jules.google.com"
  echo ""
  echo "  Check status:"
  echo "  curl -s 'https://jules.googleapis.com/v1alpha/sessions' \\"
  echo "    -H \"X-Goog-Api-Key: \$JULES_API_KEY\" | \\"
  echo "    python3 -c \"import sys,json; [print(s.get('state','?')[:20], s.get('title','?')) for s in json.load(sys.stdin).get('sessions',[][:5])]\""
  echo "════════════════════════════════════════"
}

fire_batch2() {
  echo "════════════════════════════════════════"
  echo "  Wave 2 — Batch 2 (3 sessions)"
  echo "════════════════════════════════════════"
  echo ""

  fire_session "WO-036" "[WO-036] search-service core" ".omc/work-orders/WO-013-search-service.md"
  fire_session "WO-040" "[WO-040] goal-service core" ".omc/work-orders/WO-040-goal-core.md"
  fire_session "WO-026" "[WO-026] ai-capabilities" ".omc/work-orders/WO-026-ai-capabilities.md"

  echo "════════════════════════════════════════"
  echo "  Batch 2 done — all Wave 2 sessions fired."
  echo "  Tracker: $TRACKER"
  echo "════════════════════════════════════════"
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "$BATCH" in
  1) fire_batch1 ;;
  2) fire_batch2 ;;
  all)
    fire_batch1
    echo "Waiting 10s before batch 2..."
    sleep 10
    fire_batch2
    ;;
  *)
    echo "Usage: bash fire-wave2.sh [1|2|all]"
    exit 1
    ;;
esac
