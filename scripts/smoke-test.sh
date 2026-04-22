#!/usr/bin/env bash
# E2E Smoke Test for Wave 1
# Requires all services to be running (docker-compose up)

GATEWAY_URL=${1:-"http://localhost:3000"}

echo "🚀 Starting E2E Smoke Test..."

# 1. Register
echo "1. Registering user..."
REGISTER_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"SecurePass123!","name":"Smoke Test"}')

TOKEN=$(echo $REGISTER_RES | jq -r '.data.token')

if [ "$TOKEN" == "null" ]; then
  echo "❌ Registration failed"
  echo $REGISTER_RES
  exit 1
fi
echo "✅ Registered successfully"

# 2. Create Workspace
echo "2. Creating workspace..."
WS_RES=$(curl -s -X POST "$GATEWAY_URL/api/v1/workspaces" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Workspace","slug":"smoke-ws"}')

WS_ID=$(echo $WS_RES | jq -r '.data.id')
if [ "$WS_ID" == "null" ]; then
  echo "❌ Workspace creation failed"
  echo $WS_RES
  exit 1
fi
echo "✅ Workspace created: $WS_ID"

# 3. Health Check Aggregation
echo "3. Checking gateway health aggregation..."
HEALTH_RES=$(curl -s -X GET "$GATEWAY_URL/health/services")
echo $HEALTH_RES | jq .

echo "🎉 Smoke test completed successfully!"
