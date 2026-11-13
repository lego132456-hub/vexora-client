const { contextBridge, ipcRenderer } = require('electron');
const call = (n) => (o) => ipcRenderer.invoke(n, o);
contextBridge.exposeInMainWorld('api', {
  versions: call('versions'), sysram: call('sysram'), login: call('login'), offline: call('offline'), restore: call('restore'), logout: call('logout'), hotkey: call('hotkey'),
  search: call('search'), install: call('install'), installed: call('installed'),
  removeMod: call('removeMod'), play: call('play'), openFolder: call('openFolder'),
  onLog: (cb) => ipcRenderer.on('log', (_, m) => cb(m)),
  onProgress: (cb) => ipcRenderer.on('progress', (_, p) => cb(p)),
});
