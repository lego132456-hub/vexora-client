const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { Client } = require('minecraft-launcher-core');
const { Auth } = require('msmc');

const ROOT = path.join(app.getPath('appData'), '.vexora');
const UA = { 'User-Agent': 'Vexora-Launcher/2.0' };
const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
// Mody od FPS instalowane automatycznie na Fabric (slug z Modrinth)
const BOOST_MODS = ['fabric-api', 'sodium', 'lithium', 'ferrite-core', 'modernfix', 'entityculling', 'immediatelyfast', 'moreculling', 'dynamic-fps', 'sodium-extra'];
let win, mcAuth = null;
// Skrót klawiszowy działający także gdy okno gry ma fokus (wymaga uiohook-napi)
let uio = null, hotKey = 'ShiftRight', hotOn = true, gameRunning = false;
function toggleOverlay() {
  if (!win) return;
  if (win.isVisible() && win.isFocused() && !win.isMinimized()) { win.setAlwaysOnTop(false); win.minimize(); }
  else { if (win.isMinimized()) win.restore(); win.show(); win.setAlwaysOnTop(true, 'screen-saver'); win.focus(); }
}
try {
  uio = require('uiohook-napi');
  uio.uIOhook.on('keydown', (e) => { if (hotOn && gameRunning && e.keycode === uio.UiohookKey[hotKey]) toggleOverlay(); });
  uio.uIOhook.start();
} catch (e) { uio = null; }
const TOK = path.join(ROOT, 'ms-token.json');

const getJson = async (url, headers = {}) => {
  const r = await fetch(url, { headers: { ...UA, ...headers } });
  if (!r.ok) throw new Error(`Błąd ${r.status}: ${url}`);
  return r.json();
};
const download = async (url, dest) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`Nie udało się pobrać pliku (${r.status})`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
};
const log = (m, raw = false) => win && win.webContents.send('log', { m: String(m), raw });
const mask = (s) => String(s).replace(/(--(?:accessToken|uuid|clientId|xuid)\s+)\S+/g, '$1***').replace(/(access_token\W+)\S+/g, '$1***');
const prog = (p) => win && win.webContents.send('progress', p);
const instDir = (mc, loader) => path.join(ROOT, 'instances', `${loader}-${mc}`);
const modsDir = (mc, loader) => path.join(instDir(mc, loader), 'mods');

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1120, height: 740, minWidth: 900, minHeight: 620, title: 'Vexora',
    autoHideMenuBar: true, backgroundColor: '#0f1511',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { try { uio && uio.uIOhook.stop(); } catch (e) {} });
ipcMain.handle('hotkey', (_, { on, key }) => { hotOn = !!on; if (key && uio && uio.UiohookKey[key]) hotKey = key; return !!uio; });

ipcMain.handle('sysram', () => Math.round(os.totalmem() / 1073741824));

ipcMain.handle('versions', async () => {
  const m = await getJson(MANIFEST);
  return { latest: m.latest.release, list: m.versions.filter((v) => v.type === 'release' || v.type === 'snapshot').map((v) => ({ id: v.id, type: v.type })) };
});

ipcMain.handle('login', async () => {
  const xbox = await new Auth('select_account').launch('electron');
  const mc = await xbox.getMinecraft();
  mcAuth = mc.mclc();
  try { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(TOK, JSON.stringify({ t: xbox.save() })); } catch (e) {}
  return { name: mc.profile.name };
});
ipcMain.handle('restore', async () => {
  try {
    const { t } = JSON.parse(fs.readFileSync(TOK, 'utf8'));
    const xbox = await new Auth('select_account').refresh(t);
    const mc = await xbox.getMinecraft();
    mcAuth = mc.mclc();
    fs.writeFileSync(TOK, JSON.stringify({ t: xbox.save() }));
    return { name: mc.profile.name };
  } catch (e) { return null; }
});
ipcMain.handle('logout', () => { mcAuth = null; fs.rmSync(TOK, { force: true }); });

// Konto offline (bez zakupu gry): działa w singleplayerze i na serwerach no-premium
ipcMain.handle('offline', (_, { name }) => {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name || '')) throw new Error('Nick: 3–16 znaków, tylko litery, cyfry i _.');
  const h = crypto.createHash('md5').update('OfflinePlayer:' + name).digest();
  h[6] = (h[6] & 0x0f) | 0x30; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.toString('hex');
  const uuid = `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
  mcAuth = { access_token: '0', client_token: '0', uuid, name, user_properties: '{}', meta: { type: 'mojang', demo: false } };
  return { name, offline: true };
});

/* ---------- MODRINTH ---------- */
const MR = 'https://api.modrinth.com/v2';
async function mrInstall(idOrSlug, loader, mc) {
  const q = `loaders=${encodeURIComponent(JSON.stringify([loader]))}&game_versions=${encodeURIComponent(JSON.stringify([mc]))}`;
  const vs = await getJson(`${MR}/project/${idOrSlug}/version?${q}`);
  if (!vs.length) throw new Error(`Brak wersji tego moda dla ${loader} ${mc}.`);
  const f = vs[0].files.find((x) => x.primary) || vs[0].files[0];
  const dest = path.join(modsDir(mc, loader), f.filename);
  if (!fs.existsSync(dest)) await download(f.url, dest);
  return f.filename;
}

/* ---------- CURSEFORGE ---------- */
const CFL = { fabric: 4, forge: 1, neoforge: 6 };
const CFSORT = { relevance: 1, downloads: 6, newest: 11, updated: 3 };
async function cf(p, key) {
  const r = await fetch('https://api.curseforge.com/v1' + p, { headers: { ...UA, 'x-api-key': key, Accept: 'application/json' } });
  if (r.status === 401 || r.status === 403) throw new Error('Nieprawidłowy klucz API CurseForge (Ustawienia → Konta).');
  if (!r.ok) throw new Error('CurseForge: błąd ' + r.status);
  return r.json();
}

ipcMain.handle('search', async (_, o) => {
  const { source, query, loader, mc, cat, sort, cfKey } = o;
  if (source === 'curseforge') {
    if (!cfKey) throw new Error('Brak klucza API CurseForge.');
    const q = `/mods/search?gameId=432&classId=6&pageSize=24&sortOrder=desc&sortField=${CFSORT[sort] || 6}`
      + `&searchFilter=${encodeURIComponent(query || '')}&gameVersion=${encodeURIComponent(mc)}`
      + (CFL[loader] ? `&modLoaderType=${CFL[loader]}` : '');
    const d = await cf(q, cfKey);
    return d.data.map((h) => ({ id: String(h.id), title: h.name, desc: h.summary, icon: h.logo && h.logo.thumbnailUrl,
      downloads: h.downloadCount, author: (h.authors[0] || {}).name || '', cats: [] }));
  }
  const facets = [['project_type:mod']];
  if (loader !== 'vanilla') facets.push([`categories:${loader}`]);
  if (mc) facets.push([`versions:${mc}`]);
  if (cat) facets.push([`categories:${cat}`]);
  const idx = query && !sort ? 'relevance' : (sort || 'downloads');
  const d = await getJson(`${MR}/search?limit=24&index=${idx}&query=${encodeURIComponent(query || '')}&facets=${encodeURIComponent(JSON.stringify(facets))}`);
  return d.hits.map((h) => ({ id: h.project_id, title: h.title, desc: h.description, icon: h.icon_url,
    downloads: h.downloads, author: h.author, cats: h.display_categories || [] }));
});

ipcMain.handle('install', async (_, { source, id, loader, mc, cfKey }) => {
  if (source === 'curseforge') {
    const d = await cf(`/mods/${id}/files?gameVersion=${encodeURIComponent(mc)}&modLoaderType=${CFL[loader]}&pageSize=1`, cfKey);
    const f = d.data[0];
    if (!f) throw new Error(`Brak pliku dla ${loader} ${mc}.`);
    if (!f.downloadUrl) throw new Error('Autor wyłączył pobieranie spoza strony CurseForge.');
    await download(f.downloadUrl, path.join(modsDir(mc, loader), f.fileName));
    return f.fileName;
  }
  return mrInstall(id, loader, mc);
});

ipcMain.handle('installed', (_, { loader, mc }) => {
  const d = modsDir(mc, loader);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.jar')) : [];
});
ipcMain.handle('removeMod', (_, { loader, mc, file }) => {
  fs.rmSync(path.join(modsDir(mc, loader), path.basename(file)), { force: true });
});
ipcMain.handle('openFolder', (_, { loader, mc }) => {
  const d = mc ? instDir(mc, loader) : ROOT;
  fs.mkdirSync(d, { recursive: true });
  shell.openPath(d);
});

/* ---------- JAVA (pobierana automatycznie) ---------- */
function findJava(dir) {
  if (!fs.existsSync(dir)) return null;
  const name = process.platform === 'win32' ? 'javaw.exe' : 'java';
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { const r = walk(p); if (r) return r; }
      else if (e.name === name && path.basename(d) === 'bin') return p;
    }
    return null;
  };
  return walk(dir);
}
async function ensureJava(mc) {
  const m = await getJson(MANIFEST);
  const v = m.versions.find((x) => x.id === mc);
  const major = ((await getJson(v.url)).javaVersion || {}).majorVersion || 8;
  const dir = path.join(ROOT, 'runtime', `jre-${major}`);
  let bin = findJava(dir);
  if (bin) return bin;
  log(`Pobieram Javę ${major} (jednorazowo)…`);
  const plat = { win32: 'windows', darwin: 'mac', linux: 'linux' }[process.platform];
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  const arc = path.join(ROOT, 'runtime', `jre-${major}.${plat === 'windows' ? 'zip' : 'tar.gz'}`);
  await download(`https://api.adoptium.net/v3/binary/latest/${major}/ga/${plat}/${arch}/jre/hotspot/normal/eclipse`, arc);
  fs.mkdirSync(dir, { recursive: true });
  await new Promise((res, rej) => execFile('tar', ['-xf', arc, '-C', dir], (e) => (e ? rej(e) : res())));
  fs.rmSync(arc, { force: true });
  bin = findJava(dir);
  if (!bin) throw new Error('Nie udało się zainstalować Javy.');
  return bin;
}

/* ---------- FABRIC + OPTYMALIZACJA ---------- */
async function prepareFabric(mc) {
  const list = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${mc}`);
  if (!list.length) throw new Error(`Fabric nie wspiera jeszcze wersji ${mc}.`);
  const lv = list[0].loader.version;
  const profile = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${mc}/${lv}/profile/json`);
  const dest = path.join(ROOT, 'versions', profile.id, `${profile.id}.json`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(profile));
  return profile.id;
}
async function installBoostMods(mc) {
  let i = 0;
  for (const slug of BOOST_MODS) {
    prog(15 + Math.round((i++ / BOOST_MODS.length) * 25));
    log(`FPS Boost: ${slug}…`);
    try { await mrInstall(slug, 'fabric', mc); } catch (e) { log(`  pominięto ${slug} (brak dla ${mc})`); }
  }
}
function writeOptions(dir, o) {
  const f = path.join(dir, 'options.txt');
  const map = new Map((fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean) : []).map((l) => [l.split(':')[0], l]));
  const set = (k, v) => map.set(k, `${k}:${v}`);
  set('renderDistance', o.rd); set('simulationDistance', o.sd); set('maxFps', o.fps);
  set('enableVsync', !!o.vsync); set('particles', o.particles); set('entityShadows', !!o.shadows);
  set('graphicsMode', o.fancy ? 1 : 0); set('biomeBlendRadius', o.fancy ? 3 : 1);
  set('entityDistanceScaling', o.fancy ? 1.0 : 0.75); set('mipmapLevels', o.fancy ? 4 : 2);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(f, [...map.values()].join('\n') + '\n');
}

/* ---------- GRAJ ---------- */
ipcMain.handle('play', async (_, o) => {
  const { mc, loader, ram, javaPath, jvm, width, height, fullscreen, after, mods, gfx } = o;
  if (!mcAuth) throw new Error('Najpierw wybierz konto.');
  if (loader === 'forge' || loader === 'neoforge') throw new Error('Instalator Forge/NeoForge dojdzie w kolejnej wersji. Wybierz Fabric lub Vanilla w Ustawieniach.');
  const dir = instDir(mc, loader);
  fs.mkdirSync(path.join(dir, 'mods'), { recursive: true });
  prog(3);
  const java = javaPath || await ensureJava(mc);
  prog(10);
  const version = { number: mc, type: /^\d+(\.\d+)*$/.test(mc) ? 'release' : 'snapshot' };
  if (loader === 'fabric') { log('Przygotowuję Fabric…'); version.custom = await prepareFabric(mc); if (mods) await installBoostMods(mc); }
  if (gfx) writeOptions(dir, o);
  const preTouch = (jvm || []).includes('-XX:+AlwaysPreTouch');
  const launcher = new Client();
  launcher.on('progress', (p) => { prog(40 + Math.round((p.task / Math.max(p.total, 1)) * 55)); log(`Pobieranie: ${p.type} (${p.task}/${p.total})`); });
  launcher.on('data', (d) => log(String(d).trim(), true));
  launcher.on('debug', (d) => log(mask(d), true));
  launcher.on('close', () => { gameRunning = false; if (win) win.setAlwaysOnTop(false); prog(0); log('Gra została zamknięta.'); });
  log('Uruchamiam grę…');
  await launcher.launch({
    authorization: mcAuth, root: ROOT, version, javaPath: java,
    memory: { max: `${ram}G`, min: preTouch ? `${ram}G` : '1G' },
    overrides: { gameDirectory: dir }, customArgs: jvm || [],
    window: { width, height, fullscreen },
  });
  prog(100);
  gameRunning = true;
  if (after === 'min' && win) win.minimize();
  return true;
});
