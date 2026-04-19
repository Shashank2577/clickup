#!/usr/bin/env bash
# Monitor Wave 1 Jules sessions
# Run: ./scripts/check-wave1.sh

if [ -z "$JULES_API_KEY" ]; then
  echo "❌ JULES_API_KEY not set"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ClickUp OSS — Wave 1 Jules Session Status"
echo "═══════════════════════════════════════════════════════"

curl -s "https://jules.googleapis.com/v1alpha/sessions" \
  -H "X-Goog-Api-Key: $JULES_API_KEY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
sessions = data.get('sessions', [])

states = {'COMPLETED': [], 'IN_PROGRESS': [], 'PLANNING': [], 'AWAITING_USER_INPUT': [], 'FAILED': []}
for s in sessions:
    state = s.get('state', 'UNKNOWN')
    title = s.get('title', 'Unknown')[:55]
    pr = s.get('pullRequest', {}).get('url', '')
    entry = {'title': title, 'pr': pr, 'id': s.get('name','').split('/')[-1]}
    states.setdefault(state, []).append(entry)

total = len(sessions)
done = len(states.get('COMPLETED', []))
print(f'\nProgress: {done}/{total} complete\n')

emojis = {'COMPLETED': '✅', 'IN_PROGRESS': '🟡', 'PLANNING': '📋', 'AWAITING_USER_INPUT': '⏸️', 'FAILED': '❌'}

for state, emoji in emojis.items():
    items = states.get(state, [])
    if items:
        print(f'{emoji} {state} ({len(items)})')
        for s in items:
            pr_text = f\" → {s['pr']}\" if s['pr'] else ''
            print(f\"  {s['title']}{pr_text}\")
        print()

if done == total and total > 0:
    print('🎉 All sessions complete! Merge the PRs then fire Batch 2.')
elif not states.get('FAILED'):
    print('⏱  Still running. Check again in 15-20 minutes.')
else:
    print('⚠️  Some sessions failed. Check jules.google.com for details.')
"

echo ""
echo "  To check PRs: gh pr list --repo Shashank2577/clickup"
echo "═══════════════════════════════════════════════════════"
