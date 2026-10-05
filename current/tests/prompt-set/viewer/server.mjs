// Local viewer for the video-prompt test set. Built-in modules only.
// Run: node current/tests/prompt-set/viewer/server.mjs   (PORT env var overrides 4321)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEST_SET = path.resolve(HERE, '..');
const SOURCE_MD = path.join(TEST_SET, 'video-prompts.md');
const OUT_JSON = path.join(TEST_SET, 'my-prompts.json');
const OUT_MD = path.join(TEST_SET, 'my-prompts.md');
const OUT_CSV = path.join(TEST_SET, 'my-prompts.csv');
const INDEX = path.join(HERE, 'index.html');
const PORT = Number(process.env.PORT) || 4321;
const HOST = '127.0.0.1';
const MAX_BODY = 5 * 1024 * 1024;

const FIELDS = ['id', 'created', 'updated', 'group', 'prompt', 'uploads', 'tests', 'expected_handling'];

async function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data, 'utf8');
  await fs.rename(tmp, file);
}

function str(v) {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function normalize(list) {
  if (!Array.isArray(list)) throw new Error('Body must be a JSON array of entries.');
  return list.map((e, i) => {
    if (!e || typeof e !== 'object') throw new Error(`Entry ${i} is not an object.`);
    const out = {};
    for (const f of FIELDS) out[f] = str(e[f]);
    if (!out.id) throw new Error(`Entry ${i} has no id.`);
    if (e.starter) out.starter = str(e.starter);
    return out;
  });
}

function csvCell(v) {
  const s = str(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(list) {
  const rows = [FIELDS.join(',')];
  for (const e of list) rows.push(FIELDS.map((f) => csvCell(e[f])).join(','));
  return rows.join('\r\n') + '\r\n';
}

function oneLine(s) {
  return str(s).replace(/\s+/g, ' ').trim();
}

function title(prompt) {
  const words = oneLine(prompt).split(' ').filter(Boolean);
  if (!words.length) return '(empty prompt)';
  return words.slice(0, 8).join(' ') + (words.length > 8 ? ' …' : '');
}

function multiBullet(label, value) {
  const v = str(value).trim();
  if (!v) return `- **${label}:** —`;
  const lines = v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1) return `- **${label}:** ${lines[0]}`;
  return `- **${label}:**\n` + lines.map((l) => `  - ${l.replace(/^[-*]\s+/, '')}`).join('\n');
}

function toMarkdown(list) {
  const out = [
    '# My Video Prompts',
    '',
    '- Written by the test-set viewer (`viewer/server.mjs`). Do not edit by hand; edits are overwritten on the next save.',
    '- Source of truth: `my-prompts.json`. A CSV copy is in `my-prompts.csv`.',
    `- Entries: ${list.length}. Last write: ${new Date().toISOString()}.`,
    '',
  ];
  list.forEach((e, i) => {
    out.push(`## ${i + 1}. ${title(e.prompt)}`, '');
    out.push(multiBullet('Group', e.group));
    out.push(multiBullet('Uploads', e.uploads));
    out.push(multiBullet('Tests', e.tests));
    out.push(multiBullet('Expected handling', e.expected_handling));
    out.push(`- **Created:** ${e.created || '—'}`);
    out.push(`- **Updated:** ${e.updated || '—'}`);
    out.push('');
    const p = str(e.prompt).trim();
    out.push(p ? p.split(/\r?\n/).map((l) => (l ? `> ${l}` : '>')).join('\n') : '> (empty)');
    out.push('');
  });
  return out.join('\n');
}

async function loadSaved() {
  try {
    const data = JSON.parse(await fs.readFile(OUT_JSON, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Body too large.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

let writeChain = Promise.resolve();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return send(res, 200, await fs.readFile(INDEX), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/data/video-prompts.md') {
      return send(res, 200, await fs.readFile(SOURCE_MD), 'text/markdown; charset=utf-8');
    }
    if (url.pathname === '/api/my-prompts') {
      if (req.method === 'GET') {
        return send(res, 200, JSON.stringify(await loadSaved()), 'application/json; charset=utf-8');
      }
      if (req.method === 'PUT') {
        let list;
        try {
          list = normalize(JSON.parse(await readBody(req)));
        } catch (err) {
          return send(res, 400, JSON.stringify({ error: err.message }), 'application/json; charset=utf-8');
        }
        const job = writeChain.then(async () => {
          await writeAtomic(OUT_JSON, JSON.stringify(list, null, 2) + '\n');
          await writeAtomic(OUT_MD, toMarkdown(list));
          await writeAtomic(OUT_CSV, toCsv(list));
        });
        writeChain = job.catch(() => {});
        await job;
        return send(
          res,
          200,
          JSON.stringify({ ok: true, count: list.length, savedAt: new Date().toISOString() }),
          'application/json; charset=utf-8',
        );
      }
      res.setHeader('Allow', 'GET, PUT');
      return send(res, 405, 'Method not allowed');
    }
    return send(res, 404, 'Not found');
  } catch (err) {
    console.error(err);
    return send(res, 500, JSON.stringify({ error: err.message }), 'application/json; charset=utf-8');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Test-set viewer running at http://${HOST}:${PORT}/`);
  console.log(`Saving to ${path.relative(process.cwd(), TEST_SET) || '.'}/my-prompts.{md,csv,json}`);
});
