// ZCode account switcher — main-process injected module.
// Runs inside ZCode's main process (ESM). Starts a loopback-only HTTP server
// that manages per-account credential snapshots and restarts the app on switch.
// The renderer UI (ui_accounts.js) talks to it over http://127.0.0.1:PORT.
import { app } from 'electron';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = 27890;
const PREFIX = '[account-switcher]';

function log(...a) {
  try { console.log(PREFIX, ...a); } catch {}
}

// ---- credentials paths (mirrors the app's own layout) ---------------------
const CREDENTIALS_PATH = path.join(os.homedir(), '.zcode', 'v2', 'credentials.json');
const PROFILES_DIR = path.join(os.homedir(), '.zcode', 'account-profiles');
const PROFILES_PATH = path.join(PROFILES_DIR, 'profiles.json');

// ---- crypto (AES-256-GCM, key = sha256 of the app's deterministic secret) --
const KEY = (() => {
  const secret = process.env.ZCODE_CREDENTIAL_SECRET ||
    `zcode-credential-fallback:${os.platform()}:${os.homedir()}:${os.userInfo().username}`;
  return crypto.createHash('sha256').update(secret).digest();
})();

function decrypt(v) {
  if (!v || typeof v !== 'string' || !v.startsWith('enc:v1:')) return v;
  const parts = v.slice('enc:v1:'.length).split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const data = Buffer.from(parts[2], 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ---- credentials / profile store -----------------------------------------
async function readCredentials() {
  try {
    const raw = await fsp.readFile(CREDENTIALS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function decryptJwtPayload(encVal) {
  if (!encVal) return null;
  const dec = decrypt(encVal);
  if (!dec || typeof dec !== 'string' || dec.indexOf('.') < 0) return null;
  try {
    return JSON.parse(Buffer.from(dec.split('.')[1] || '', 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function identityFrom(creds) {
  // provider ("zai" | "bigmodel" | ...) decides which user_info schema applies
  let provider = '';
  try {
    const p = decrypt(creds?.['oauth:active_provider']);
    if (typeof p === 'string') provider = p.trim();
  } catch {}
  let info = null;
  if (provider) {
    try {
      const dec = decrypt(creds?.[`oauth:${provider}:user_info`]);
      if (dec) info = JSON.parse(dec);
    } catch {}
  }
  const raw = info?.rawProfile && typeof info.rawProfile === 'object' ? info.rawProfile : null;
  const zjwt = decryptJwtPayload(creds?.zcodejwttoken);
  const atok = provider ? decryptJwtPayload(creds?.[`oauth:${provider}:access_token`]) : null;
  const userId = String(
    info?.user_id || info?.id || raw?.user_id || raw?.id ||
    zjwt?.user_id || zjwt?.sub ||
    atok?.customer_id || atok?.user_id || ''
  ) || null;
  const email = info?.email || raw?.email || '';
  const name = info?.displayName || info?.name || info?.username || raw?.name || raw?.username || email || '';
  return { userId, email, name, provider };
}

async function readProfiles() {
  try {
    const raw = await fsp.readFile(PROFILES_PATH, 'utf8');
    const obj = JSON.parse(raw);
    return Array.isArray(obj?.profiles) ? obj.profiles : [];
  } catch {
    return [];
  }
}

async function writeProfiles(profiles) {
  await fsp.mkdir(PROFILES_DIR, { recursive: true });
  const tmp = PROFILES_PATH + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify({ profiles }, null, 2), 'utf8');
  await fsp.rename(tmp, PROFILES_PATH);
}

async function writeCredentials(entries) {
  const dir = path.dirname(CREDENTIALS_PATH);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = CREDENTIALS_PATH + '.switcher-tmp';
  await fsp.writeFile(tmp, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  await fsp.rename(tmp, CREDENTIALS_PATH);
}

// ---- HTTP helpers ---------------------------------------------------------
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { if (data.length < 1e6) data += c; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

function scheduleRelaunch() {
  const doRelaunch = () => {
    try { app.relaunch(); } catch (e) { log('relaunch failed', e); }
    try { app.exit(0); } catch (e) { log('exit failed', e); }
  };
  if (app.isReady()) {
    setTimeout(doRelaunch, 400);
  } else {
    app.once('ready', () => setTimeout(doRelaunch, 400));
  }
}

// ---- state -----------------------------------------------------------------
function inferProvider(entries) {
  const keys = Object.keys(entries || {});
  if (keys.some((k) => k.startsWith('oauth:bigmodel:'))) return 'bigmodel';
  if (keys.some((k) => k.startsWith('oauth:zai:'))) return 'zai';
  return '';
}

async function buildState() {
  const creds = await readCredentials();
  const active = identityFrom(creds || {});
  const profiles = await readProfiles();
  const list = profiles.map((p) => {
    const provider = p.provider || inferProvider(p.entries);
    return {
      id: p.id,
      name: p.name || p.email || p.userId || '未知账号',
      email: p.email || '',
      userId: p.userId || '',
      provider,
      remark: p.remark || '',
      isActive: !!(active.userId && p.userId === active.userId),
    };
  });
  return {
    active: {
      name: active.name || '未登录',
      email: active.email || '',
      userId: active.userId || '',
      provider: active.provider,
    },
    profiles: list,
    loggedIn: !!creds,
  };
}

// ---- handlers --------------------------------------------------------------
async function handleCapture() {
  const creds = await readCredentials();
  if (!creds) return { ok: false, error: '当前未登录，无法添加账号' };
  const idn = identityFrom(creds);
  if (!idn.userId) return { ok: false, error: '无法识别当前账号身份' };
  const profiles = await readProfiles();
  const existing = profiles.find((p) => p.userId === idn.userId);
  if (existing) {
    // refresh the stored snapshot with the latest credentials
    existing.entries = creds;
    existing.name = idn.name || existing.name;
    existing.email = idn.email || existing.email;
    existing.provider = idn.provider || existing.provider;
    if (existing.remark === undefined) existing.remark = '';
    existing.updatedAt = Date.now();
  } else {
    profiles.push({
      id: crypto.randomUUID(),
      name: idn.name,
      email: idn.email,
      userId: idn.userId,
      provider: idn.provider,
      remark: '',
      entries: creds,
      addedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  await writeProfiles(profiles);
  return { ok: true };
}

async function handleRemark(body) {
  const id = body?.id;
  const remark = typeof body?.remark === 'string' ? body.remark.slice(0, 80) : null;
  if (!id || remark === null) return { ok: false, error: '参数错误' };
  const profiles = await readProfiles();
  const p = profiles.find((x) => x.id === id);
  if (!p) return { ok: false, error: '账号不存在' };
  p.remark = remark;
  p.updatedAt = Date.now();
  await writeProfiles(profiles);
  return { ok: true };
}

async function handleSwitch(body) {
  const id = body?.id;
  if (!id) return { ok: false, error: '缺少账号 id' };
  const profiles = await readProfiles();
  const p = profiles.find((x) => x.id === id);
  if (!p) return { ok: false, error: '账号不存在' };
  await writeCredentials(p.entries);
  return { ok: true, relaunch: true };
}

async function handleDelete(body) {
  const id = body?.id;
  if (!id) return { ok: false, error: '缺少账号 id' };
  let profiles = await readProfiles();
  const before = profiles.length;
  profiles = profiles.filter((x) => x.id !== id);
  await writeProfiles(profiles);
  return { ok: true, removed: before - profiles.length };
}

// ---- server -----------------------------------------------------------------
const DIAG = []; // last renderer diagnostic reports (POST /api/diag)

function startServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Private-Network': 'true',
      });
      res.end();
      return;
    }
    const url = (req.url || '').split('?')[0];
    try {
      if (req.method === 'GET' && url === '/api/state') {
        json(res, 200, await buildState());
      } else if (req.method === 'POST' && url === '/api/capture') {
        const r = await handleCapture();
        json(res, 200, { ...r, state: await buildState() });
      } else if (req.method === 'POST' && url === '/api/switch') {
        const r = await handleSwitch(await readBody(req));
        json(res, 200, r);
        if (r.ok && r.relaunch) scheduleRelaunch();
      } else if (req.method === 'POST' && url === '/api/delete') {
        const r = await handleDelete(await readBody(req));
        json(res, 200, { ...r, state: await buildState() });
      } else if (req.method === 'POST' && url === '/api/remark') {
        const r = await handleRemark(await readBody(req));
        json(res, 200, { ...r, state: await buildState() });
      } else if (req.method === 'POST' && url === '/api/diag') {
        // renderer diagnostics sink; keep the last 40 reports readable via GET
        try {
          const b = await readBody(req);
          DIAG.push({ at: new Date().toISOString(), ...(b || {}) });
          if (DIAG.length > 40) DIAG.splice(0, DIAG.length - 40);
        } catch {}
        json(res, 200, { ok: true });
      } else if (req.method === 'GET' && url === '/api/diag') {
        json(res, 200, { ok: true, diag: DIAG });
      } else {
        json(res, 404, { ok: false, error: 'not found' });
      }
    } catch (e) {
      log('handler error', e);
      json(res, 500, { ok: false, error: String(e && e.message || e) });
    }
  });

  server.on('error', (e) => log('server error', e));
  server.listen(PORT, '127.0.0.1', () => log('listening on 127.0.0.1:' + PORT));
  return server;
}

// ---- entry -------------------------------------------------------------------
let started = false;
function start() {
  if (started) return;
  started = true;
  try {
    startServer();
    log('started (credentials:', CREDENTIALS_PATH, ')');
  } catch (e) {
    log('failed to start', e);
  }
}

// Start immediately; HTTP serving doesn't need app readiness.
start();
