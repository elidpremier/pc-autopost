import { NextResponse } from 'next/server';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const dynamic = 'force-dynamic';

export async function POST() {
  const script = path.join(process.cwd(), 'scripts', 'stop.sh');
  const child = spawn('bash', [script], { cwd: process.cwd(), detached: true, stdio: 'ignore' });
  child.unref();
  setTimeout(() => {
    try { process.kill(process.pid, 'SIGTERM'); } catch { /* serveur déjà arrêté */ }
  }, 250);
  return NextResponse.json({ stopping: true });
}
