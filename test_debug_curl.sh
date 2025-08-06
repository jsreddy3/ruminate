#!/bin/bash
# Manual test with curl

# Set your auth token here
AUTH_TOKEN="YOUR_TOKEN_HERE"
API_BASE="http://localhost:8000"

echo "1. Creating conversation..."
CONV_RESPONSE=$(curl -s -X POST "$API_BASE/conversations" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "CHAT"}')

CONV_ID=$(echo $CONV_RESPONSE | jq -r '.conversation_id')
echo "Created conversation: $CONV_ID"

echo -e "\n2. Sending message with debug mode..."
MSG_RESPONSE=$(curl -s -X POST "$API_BASE/conversations/$CONV_ID/messages" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Debug-Mode: true" \
  -d '{"content": "Test message in debug mode"}')

echo "Response: $MSG_RESPONSE"

echo -e "\n3. Checking pending approvals..."
curl -s "$API_BASE/prompt-approval/pending/list" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq .