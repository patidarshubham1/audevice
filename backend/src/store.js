import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');

const defaultState = { people: [], devices: [] };

export async function readState() {
  try {
    const raw = await readFile(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeState(defaultState);
    return defaultState;
  }
}

export async function writeState(state) {
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(state, null, 2));
}

export async function updateState(updater) {
  const state = await readState();
  const next = await updater(structuredClone(state));
  await writeState(next);
  return next;
}
