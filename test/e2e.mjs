// End-to-end check of a Kept deploy: node test/e2e.mjs BASE_URL SETUP_CODE MODE
// MODE=create: first-run setup, sign-in, a location, a thing, a photo upload (file storage) and
// fetching it back. MODE=check: sign in again and confirm the thing and its photo are still there.
import { createHash, randomUUID } from 'node:crypto';
const [base, code, mode = 'create'] = process.argv.slice(2);
const email = 'admin@example.com', password = 'Test-password-' + 'x'.repeat(12);
let cookie = '';
const uuid7 = () => { const t = Date.now().toString(16).padStart(12, '0'); const r = randomUUID().replace(/-/g, '');
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-7${r.slice(1, 4)}-${(8 + (parseInt(r[4], 16) & 3)).toString(16)}${r.slice(5, 8)}-${r.slice(8, 20)}`; };
async function call(method, path, body, headers = {}) {
  const h = { origin: base, ...headers };
  if (cookie) h.cookie = cookie;
  let payload;
  if (body instanceof Uint8Array) payload = body; else if (body !== undefined) { payload = JSON.stringify(body); h['content-type'] = 'application/json'; }
  const res = await fetch(base + path, { method, headers: h, body: payload, redirect: 'manual' });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((l) => l.split(';')[0]).filter((p) => !p.endsWith('=')).join('; ');
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, text };
}
const must = (r, ok, what) => { if (!ok.includes(r.status)) { console.log('FAIL', what, r.status, r.text.slice(0, 300)); process.exit(1); } console.log('ok', what, r.status); return r.json; };
// A 1x1 JPEG.
import { readFileSync } from 'node:fs';
const jpeg = process.env.PHOTO ? readFileSync(process.env.PHOTO) : Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

must(await call('GET', '/readyz'), [200], 'readyz');
const setup = must(await call('GET', '/api/v1/setup'), [200], 'setup status');
const skipSetup = mode === 'create' && !setup.needed && process.env.RESUME;
if (mode === 'create' && !skipSetup) {
  if (!setup.needed) { console.log('FAIL setup already done'); process.exit(1); }
  must(await call('POST', '/api/v1/setup', { code: 'WRONG1', email, password, displayName: 'Admin' }), [400, 401, 403, 429], 'wrong setup code refused');
  cookie = '';
  must(await call('POST', '/api/v1/setup', { code, email, password, displayName: 'Admin' }), [201], 'first-run setup with the generated code');
}
if (setup.needed && mode !== 'create') { console.log('FAIL setup needed again: data lost'); process.exit(1); }
cookie = '';
must(await call('GET', '/api/v1/things'), [401, 403], 'things without sign-in refused');
must(await call('POST', '/api/v1/auth/sign-in/email', { email, password }), [200], 'sign in');
if (mode === 'create') {
  const loc = must(await call('POST', '/api/v1/locations', { name: 'Railway test home', kind: 'home', timezone: 'UTC', currency: 'USD' }), [201], 'create location');
  const place = must(await call('POST', `/api/v1/locations/${loc.id}/places`, { name: 'Garage', kindKey: 'room' }), [201], 'create place');
  const thing = must(await call('POST', '/api/v1/things', { locationId: loc.id, placeId: place.id, name: (process.env.NAME || 'Cordless drill') }), [201], 'create thing');
  const fid = uuid7();
  const up = must(await call('PUT', `/api/v1/files/${fid}?locationId=${loc.id}&class=photo`, new Uint8Array(jpeg),
    { 'content-type': 'image/jpeg', 'x-kept-sha256': createHash('sha256').update(jpeg).digest('hex') }), [200, 201], 'upload photo');
  must(await call('POST', '/api/v1/attachments', { locationId: loc.id, fileId: String(up.id), subject: { thingId: thing.id }, role: 'photo' }), [201], 'attach photo');
}
const list = must(await call('GET', '/api/v1/things?limit=50'), [200], 'list things');
const items = list.things ?? list.items ?? [];
const drill = items.find((t) => t.name === (process.env.NAME || 'Cordless drill'));
if (!drill) { console.log('FAIL drill missing', JSON.stringify(list).slice(0, 300)); process.exit(1); }
console.log('ok thing present', drill.id);
const view = must(await call('GET', `/api/v1/things/${drill.id}`), [200], 'thing view');
const att = must(await call('GET', `/api/v1/things/${drill.id}/attachments`), [200], 'thing attachments');
const s = JSON.stringify(att);
console.log('thumbUrl', view.thumbUrl ? 'set' : 'null', 'attachments', s.slice(0, 200));
const fileId = (s.match(/"file":\{"id":"([0-9a-f-]{36})"/) || [])[1];
console.log('derivativeState', (s.match(/"derivativeState":"(\w+)"/) || [])[1]);
if (!fileId) { console.log('FAIL no photo on thing', s.slice(0, 400)); process.exit(1); }
const u = must(await call('POST', `/api/v1/files/${fileId}/url?thingId=${drill.id}`, { variant: 'original' }), [200], 'signed URL');
const abs = new URL(u.url, base).toString();
const got = await fetch(abs);
const buf = Buffer.from(await got.arrayBuffer());
console.log(got.status === 200 && buf.equals(jpeg) ? 'ok photo fetched back from storage, bytes match' : `FAIL photo fetch ${got.status} ${buf.length} ${abs.slice(0, 60)}`);
if (got.status !== 200) process.exit(1);
console.log('E2E PASS', mode);
