#!/bin/bash
# Production build script - ensures clean install of all dependencies

echo "Installing root dependencies..."
npm install

echo "Installing backend dependencies..."
cd backend && npm install

echo "Build complete!"
