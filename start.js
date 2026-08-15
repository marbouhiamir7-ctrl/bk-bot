const { spawn } = require('child_process');

function start(name, file) {
    const proc = spawn('node', [file], { stdio: 'inherit', cwd: __dirname });
    proc.on('error', (err) => console.error(`[${name}] Error:`, err.message));
    proc.on('exit', (code) => {
        console.log(`[${name}] Exited with code ${code}`);
        if (code !== 0) {
            console.log(`[${name}] Restarting...`);
            setTimeout(() => start(name, file), 2000);
        }
    });
    return proc;
}

console.log('Starting BK BOT...');
start('Dashboard', 'server.js');
start('Bot', 'index.js');
