import { readFile } from 'node:fs/promises';

const files = [
  'package.json',
  'frontend/package.json',
  'backend/package.json',
  'frontend/app/page.tsx',
  'frontend/app/page.module.css',
  'frontend/app/globals.css',
  'backend/src/server.js',
  'backend/src/store.js'
];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  if (!content.trim()) throw new Error(`${file} is empty`);
  if (file.endsWith('package.json')) JSON.parse(content);
}

const dashboard = await readFile('frontend/app/components/Dashboard.tsx', 'utf8');
for (const required of ['Assign', 'Submit', 'isAdmin', 'assignedAt', 'submittedAt']) {
  if (!dashboard.includes(required)) throw new Error(`Missing expected UI term: ${required}`);
}

console.log('Source sanity check passed.');
