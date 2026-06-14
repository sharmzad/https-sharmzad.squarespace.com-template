#!/bin/bash
set -e

echo "🚀 Starting EG Travel Market Production Deployment..."
echo ""

# Start backend immediately in background
echo "📦 Starting Backend Server..."
node backend/src/server.js &
BACKEND_PID=$!

# Small delay for backend to initialize
sleep 2

# Start frontend
echo "🌐 Starting Frontend Server..."
node frontend-server.js &
FRONTEND_PID=$!

# Function to handle cleanup
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGTERM SIGINT

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
