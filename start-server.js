const { spawn } = require('child_process');
const path = require('path');

let serverProcess = null;
let restartCount = 0;
const MAX_RESTART_ATTEMPTS = 10;
const RESTART_DELAY = 3000; // 3 seconds

console.log('🚀 Starting Twilsta Server with auto-restart capability...');

function startServer() {
  console.log(`📡 Starting server process (attempt ${restartCount + 1})...`);

  // Spawn the server process
  serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
  });

  // Handle server process exit
  serverProcess.on('exit', (code, signal) => {
    console.log(`\n⚠️  Server process exited with code ${code} and signal ${signal}`);

    if (code !== 0 && restartCount < MAX_RESTART_ATTEMPTS) {
      restartCount++;
      console.log(
        `🔄 Restarting server in ${
          RESTART_DELAY / 1000
        } seconds... (${restartCount}/${MAX_RESTART_ATTEMPTS})`,
      );

      setTimeout(() => {
        startServer();
      }, RESTART_DELAY);
    } else if (restartCount >= MAX_RESTART_ATTEMPTS) {
      console.log('❌ Max restart attempts reached. Please check the logs and restart manually.');
      process.exit(1);
    } else {
      console.log('✅ Server stopped gracefully.');
      process.exit(0);
    }
  });

  // Handle server process errors
  serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server process:', error);

    if (restartCount < MAX_RESTART_ATTEMPTS) {
      restartCount++;
      console.log(
        `🔄 Retrying in ${
          RESTART_DELAY / 1000
        } seconds... (${restartCount}/${MAX_RESTART_ATTEMPTS})`,
      );

      setTimeout(() => {
        startServer();
      }, RESTART_DELAY);
    } else {
      console.log('❌ Max restart attempts reached. Exiting...');
      process.exit(1);
    }
  });

  // Reset restart count on successful start
  setTimeout(() => {
    if (serverProcess && !serverProcess.killed) {
      restartCount = 0;
      console.log('✅ Server running successfully, restart counter reset.');
    }
  }, 10000); // Reset after 10 seconds of successful running
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, stopping server...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, stopping server...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});

// Start the server
startServer();
