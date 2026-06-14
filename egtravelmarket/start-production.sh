#!/bin/bash
# Start backend in background
cd /home/runner/workspace/backend
echo "🚀 Starting backend service..."
npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to start..."
for i in {1..10}; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    break
  fi
  echo "  Attempt $i/10..."
  sleep 1
done

# Start frontend
echo "🌐 Starting frontend proxy..."
cd /home/runner/workspace
node frontend-server.js
