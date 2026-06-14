const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting EG Travel Market Production Servers...');

const backendProcess = spawn('node', ['backend/src/server.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env }
});

const frontendProcess = spawn('node', ['frontend-server.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env }
});

backendProcess.on('error', (err) => {
  console.error('❌ Backend failed to start:', err);
});

frontendProcess.on('error', (err) => {
  console.error('❌ Frontend failed to start:', err);
});

backendProcess.on('exit', (code) => {
  console.log(`Backend exited with code ${code}`);
  process.exit(code || 1);
});

frontendProcess.on('exit', (code) => {
  console.log(`Frontend exited with code ${code}`);
  process.exit(code || 1);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  backendProcess.kill();
  frontendProcess.kill();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  backendProcess.kill();
  frontendProcess.kill();
});
