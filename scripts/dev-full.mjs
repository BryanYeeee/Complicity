import { spawn } from 'node:child_process';

const envArgs = ['--env-file-if-exists=.env'];
const server = spawn(process.execPath, [...envArgs, 'server/civic-server.mjs'], { stdio: 'inherit', shell: false });
const vite = process.platform === 'win32'
  ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run dev'], { stdio: 'inherit', shell: false })
  : spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: false });
const stop = () => { server.kill(); vite.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
await Promise.race([
  new Promise((resolve) => server.on('exit', resolve)),
  new Promise((resolve) => vite.on('exit', resolve)),
]);
stop();

