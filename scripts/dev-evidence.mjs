import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const python = process.env.FIRETRACE_PYTHON ?? (process.platform === 'win32' ? 'backend/.venv/Scripts/python.exe' : 'backend/.venv/bin/python');
if (!existsSync(python)) throw new Error('Create backend/.venv and install backend/requirements-evidence.txt first (see backend/EVIDENCE.md).');
const children = new Set();
const start = (command, args) => {
  const child = spawn(command, args, { stdio: 'inherit', windowsHide: true });
  children.add(child);
  child.on('exit', () => children.delete(child));
  child.on('error', error => { console.error(error.message); stop(1); });
  return child;
};
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
const importer = start(python, ['-m', 'backend.evidence.ingest']);
importer.on('exit', code => {
  if (code !== 0) { stop(code ?? 1); return; }
  const backend = start(python, ['-m', 'uvicorn', 'backend.evidence.main:app', '--host', '127.0.0.1', '--port', '8000', '--timeout-keep-alive', '5']);
  const frontend = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', process.env.FIRETRACE_FRONTEND_PORT ?? '5173']);
  backend.on('exit', code => stop(code ?? 0));
  frontend.on('exit', code => stop(code ?? 0));
});
