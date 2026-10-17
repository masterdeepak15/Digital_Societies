import * as fs from 'fs';
import * as path from 'path';

/**
 * The server address is user-configurable at runtime, so no source file may hardcode one or read
 * the build-time default directly. Only src/config/serverConfig.ts is allowed to.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const ALLOWED = new Set([path.join(ROOT, 'src', 'config', 'serverConfig.ts')]);
const FORBIDDEN: [string, RegExp][] = [
  ['localhost:', /localhost:/],
  ['athomes.space', /athomes\.space/],
  ['EXPO_PUBLIC_API_URL', /EXPO_PUBLIC_API_URL/],
  ['API_BASE assignment', /\bAPI_BASE\s*=/],
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('no hardcoded server addresses', () => {
  it('keeps server URLs inside serverConfig.ts', () => {
    const offenders: string[] = [];
    for (const dir of ['src', 'app']) {
      for (const file of sourceFiles(path.join(ROOT, dir))) {
        if (ALLOWED.has(file)) continue;
        const text = fs.readFileSync(file, 'utf8');
        for (const [label, re] of FORBIDDEN) {
          if (re.test(text)) offenders.push(`${path.relative(ROOT, file)}: ${label}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
