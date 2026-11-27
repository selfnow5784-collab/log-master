/* db.js — IndexedDB wrapper (on-device storage, works offline, no login).
   Stores: catalog (Reference), vehicles, inventory (in stock), files (one record per imported file), meta (prefs etc).
   Migration: v3 kept in-stock items in a store called 'van'. Version 2 of the DB copies every 'van' record
   into 'inventory' (same ids) inside the upgrade transaction, then drops 'van' — nothing is lost.
   Startup also copies a previous database into ToolDudeV1 when the new one is empty, then deletes the old one,
   and renames web-storage keys that still use an old name. */
(function (G) {
  'use strict';
  const NAME = 'ToolDudeV1', STORES = ['catalog', 'vehicles', 'inventory', 'files'];
  const OLD_NAME = 'LogMasterV1';
  // Longer prefixes are listed first so a shorter one cannot match ahead of them.
  const STORAGE_RENAMES = [['LogMaster', 'ToolDude'], ['log-master', 'tool-dude'], ['logmaster', 'tooldude'], ['Tool Shelf', 'Tool Dude'], ['ToolShelf', 'ToolDude'], ['lm-', 'td-']];
  let db;
  function openNamed(name, version, onupgrade) {
    return new Promise((res, rej) => {
      const r = version == null ? indexedDB.open(name) : indexedDB.open(name, version);
      r.onupgradeneeded = () => { if (onupgrade) onupgrade(r.result, r.transaction); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  function dbNames() {
    if (!indexedDB.databases) return Promise.resolve(null);
    return indexedDB.databases().then(list => list.map(d => d.name));
  }
  function dumpDb(d) {
    const names = [...d.objectStoreNames];
    if (!names.length) return Promise.resolve({});
    return new Promise((res, rej) => {
      const tx = d.transaction(names, 'readonly'), out = {}, left = names.length;
      names.forEach(s => {
        const os = tx.objectStore(s);
        const meta = { keyPath: os.keyPath, autoIncrement: os.autoIncrement, indexes: [...os.indexNames].map(n => { const ix = os.index(n); return { name: n, keyPath: ix.keyPath, unique: ix.unique, multiEntry: ix.multiEntry }; }) };
        const records = [];
        const c = os.openCursor();
        c.onsuccess = () => { const k = c.result; if (k) { records.push({ key: k.primaryKey, value: k.value }); k.continue(); return; } out[s] = { meta, records }; if (Object.keys(out).length === left) res(out); };
        c.onerror = () => rej(c.error);
      });
      tx.onerror = () => rej(tx.error);
    });
  }
  function countAll(d) {
    const names = [...d.objectStoreNames];
    if (!names.length) return Promise.resolve(0);
    return new Promise((res, rej) => {
      const tx = d.transaction(names, 'readonly'); let n = 0, left = names.length;
      names.forEach(s => { const r = tx.objectStore(s).count(); r.onsuccess = () => { n += r.result; if (--left === 0) res(n); }; r.onerror = () => rej(r.error); });
    });
  }
  function createStore(d, name, meta) {
    if (d.objectStoreNames.contains(name)) return;
    const opts = { autoIncrement: !!(meta && meta.autoIncrement) };
    if (meta && meta.keyPath != null) opts.keyPath = meta.keyPath;
    else opts.keyPath = name === 'meta' ? 'key' : 'id';
    const os = d.createObjectStore(name, opts);
    ((meta && meta.indexes) || []).forEach(ix => os.createIndex(ix.name, ix.keyPath, { unique: !!ix.unique, multiEntry: !!ix.multiEntry }));
  }
  function foldLegacy(dump) {
    if (dump.van) {
      const inv = dump.inventory || (dump.inventory = { meta: { keyPath: 'id', autoIncrement: false, indexes: [] }, records: [] });
      const ids = new Set(inv.records.map(r => r.value && r.value.id));
      dump.van.records.forEach(r => { if (!ids.has(r.value && r.value.id)) inv.records.push(r); });
      delete dump.van;
    }
    if (dump.files) dump.files.records.forEach(r => { if (r.value && r.value.kind === 'van') r.value.kind = 'inventory'; });
  }
  function writeDump(name, dump) {
    const needed = new Set([...STORES, 'meta', ...Object.keys(dump)]);
    return openNamed(name).then(existing => {
      const missing = [...needed].filter(s => !existing.objectStoreNames.contains(s));
      const version = missing.length ? existing.version + 1 : existing.version;
      existing.close();
      return openNamed(name, Math.max(version, 2), d => { needed.forEach(s => createStore(d, s, dump[s] && dump[s].meta)); });
    }).then(dest => new Promise((res, rej) => {
      const names = Object.keys(dump).filter(s => dest.objectStoreNames.contains(s) && dump[s].records.length);
      if (!names.length) { dest.close(); res(); return; }
      const tx = dest.transaction(names, 'readwrite');
      names.forEach(s => { const os = tx.objectStore(s); dump[s].records.forEach(rec => { if (os.keyPath != null) os.put(rec.value); else os.put(rec.value, rec.key); }); });
      tx.oncomplete = () => { dest.close(); res(); }; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('copy aborted'));
    }));
  }
  function deleteDb(name) {
    return new Promise((res, rej) => { const r = indexedDB.deleteDatabase(name); r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('delete blocked')); });
  }
  function migrateWebStorage() {
    let n = 0;
    [localStorage, sessionStorage].forEach(area => {
      if (!area) return;
      const keys = []; for (let i = 0; i < area.length; i++) keys.push(area.key(i));
      keys.forEach(k => {
        if (k == null) return;
        const hit = STORAGE_RENAMES.find(p => k.startsWith(p[0]));
        if (!hit) return;
        const nk = hit[1] + k.slice(hit[0].length);
        if (nk === k) return;
        if (area.getItem(nk) == null) area.setItem(nk, area.getItem(k));
        else if (area.getItem(nk) !== area.getItem(k)) return;
        area.removeItem(k); n++;
      });
    });
    return n;
  }
  async function migrate() {
    const movedKeys = migrateWebStorage();
    const names = await dbNames();
    if (names && !names.includes(OLD_NAME)) return { copied: false, movedKeys };
    const oldDb = await openNamed(OLD_NAME);
    const dump = await dumpDb(oldDb); oldDb.close();
    foldLegacy(dump);
    let empty = true;
    if (!names || names.includes(NAME)) {
      const cur = await openNamed(NAME);
      empty = (await countAll(cur)) === 0; cur.close();
      if (!empty) { const again = await dbNames(); if (again && again.includes(NAME) && !empty) return { copied: false, movedKeys, reason: 'new-has-data' }; }
    }
    if (!empty) return { copied: false, movedKeys, reason: 'new-has-data' };
    await writeDump(NAME, dump);
    await deleteDb(OLD_NAME);
    const counts = {}; Object.keys(dump).forEach(s => { counts[s] = dump[s].records.length; });
    return { copied: true, movedKeys, counts };
  }
  function open() {
    return migrate().then(() => (indexedDB.databases ? indexedDB.databases() : Promise.resolve([]))).then(list => new Promise((res, rej) => {
      const info = (list || []).find(d => d.name === NAME);
      const r = indexedDB.open(NAME, Math.max(2, (info && info.version) || 2));
      r.onupgradeneeded = () => { const d = r.result, tx = r.transaction; STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
        if (d.objectStoreNames.contains('van')) { const inv = tx.objectStore('inventory'), g = tx.objectStore('van').getAll();
          g.onsuccess = () => { g.result.forEach(x => inv.put(x)); d.deleteObjectStore('van'); }; }
        if (tx.objectStore('files')) { const f = tx.objectStore('files'), c = f.openCursor();
          c.onsuccess = () => { const k = c.result; if (!k) return; if (k.value.kind === 'van') { k.value.kind = 'inventory'; k.update(k.value); } k.continue(); }; }
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' }); };
      r.onsuccess = () => { db = r.result; res(db); }; r.onerror = () => rej(r.error); }));
  }
  const done = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('write aborted (storage full?)')); });
  const all = s => new Promise((res, rej) => { const r = db.transaction(s).objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  function write(s, puts, dels) { const tx = db.transaction(s, 'readwrite'), os = tx.objectStore(s); (dels || []).forEach(id => os.delete(id)); (puts || []).forEach(r => os.put(r)); return done(tx); }
  function clear(s) { const tx = db.transaction(s, 'readwrite'); tx.objectStore(s).clear(); return done(tx); }
  const getMeta = k => new Promise(res => { const r = db.transaction('meta').objectStore('meta').get(k); r.onsuccess = () => res(r.result ? r.result.v : undefined); r.onerror = () => res(undefined); });
  function setMeta(k, v) { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ key: k, v }); return done(tx); }
  function delMeta(k) { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').delete(k); return done(tx); }
  G.DB = { open, all, write, clear, getMeta, setMeta, delMeta, STORES, NAME };
})(window);
