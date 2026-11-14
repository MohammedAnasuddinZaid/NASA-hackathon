import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const python = path.resolve(process.env.FIRETRACE_PYTHON ?? (process.platform === 'win32' ? 'backend/.venv/Scripts/python.exe' : 'backend/.venv/bin/python'));
if (!existsSync(python)) throw new Error('Create backend/.venv and install backend/requirements.txt first.');
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
const start = (command, args, cwd = '.') => {
  const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true });
  children.add(child);
  child.on('exit', () => children.delete(child));
  child.on('error', error => { console.error(error.message); stop(1); });
  return child;
};
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
const importer = start(python, ['scripts/build_index.py'], 'backend');
importer.on('exit', code => {
  if (code !== 0) { stop(code ?? 1); return; }
  const backend = start(python, ['-m', 'uvicorn', 'api:app', '--host', '127.0.0.1', '--port', '8000'], 'backend');
  const frontend = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', process.env.FIRETRACE_FRONTEND_PORT ?? '5173']);
  backend.on('exit', code => stop(code ?? 0));
  frontend.on('exit', code => stop(code ?? 0));
});
