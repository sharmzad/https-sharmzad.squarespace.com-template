#!/bin/bash
# Start backend in background
cd /home/runner/workspace/backend
npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "🚀 Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
sleep 4

# Check if backend is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "❌ Backend failed to start!"
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

echo "✅ Backend is healthy"

# Start frontend
cd /home/runner/workspace
node frontend-server.js
