'use strict';
// STOCK STORE — servidor: sirve la tienda (carpeta www) y envía avisos Web Push.
// Los avisos SIEMPRE parecen promociones de la tienda: nunca muestran el
// contenido del mensaje, quién lo envió, ni que exista un chat.

const express = require('express');
const path = require('path');
const https = require('https');
const webpush = require('web-push');

const DB_BASE = process.env.FIREBASE_DB_URL || 'https://stock-a3c88-default-rtdb.firebaseio.com';
const ROOT = 'stockstore';
// La tienda puede estar en la carpeta www/ o directamente en la raíz del repositorio
const WWW = require('fs').existsSync(path.join(__dirname, 'www', 'index.html')) ? path.join(__dirname, 'www') : __dirname;

// ── Claves VAPID (van en las variables de entorno de Render; ver CLAVES-PRIVADAS.txt)
const VAPID_PUBLIC = process.env.VAPID_PUBLIC || 'BGKgaWL5uVbAnbTbFRn7I5I_9Igl5G__mRe8grQu-Dq5CZHbGImeVybyWVCNgsiBsP3cYEJz32tt97n0XzTA4G0';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const pushReady = !!VAPID_PRIVATE;
if (pushReady) {
    webpush.setVapidDetails('mailto:admin@stockstore.app', VAPID_PUBLIC, VAPID_PRIVATE);
    console.log('[WebPush] VAPID configurado ✓');
} else {
    console.warn('[WebPush] Falta VAPID_PRIVATE en las variables de entorno — los avisos están desactivados');
}

// ── Express ─────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/health', (_q, r) => r.json({ status: 'ok', push: pushReady, ts: Date.now() }));
app.use(express.static(WWW, {
    setHeaders: (res, file) => {
        if (file.endsWith('sw.js')) { res.setHeader('Service-Worker-Allowed', '/'); res.setHeader('Cache-Control', 'no-cache'); }
        else if (/\.(html|js|css|json)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    }
}));

// Control rápido de avisos (links directos, igual que en VibeStore)
let pushEnabled = true;
(async () => { const v = await fbGet(`${ROOT}/config/pushEnabled`); pushEnabled = v !== false; console.log(`[Control] Avisos: ${pushEnabled ? 'ENCENDIDOS' : 'APAGADOS'}`); })();
const page = (t) => `<meta name="viewport" content="width=device-width"><h2 style="font-family:sans-serif">${t}</h2>`;
app.get('/notif-on', async (_q, r) => { pushEnabled = true; await fbPut(`${ROOT}/config/pushEnabled`, true); r.send(page('🔔 Avisos ENCENDIDOS')); });
app.get('/notif-off', async (_q, r) => { pushEnabled = false; await fbPut(`${ROOT}/config/pushEnabled`, false); r.send(page('🔕 Avisos APAGADOS')); });
app.get('/notif-status', (_q, r) => r.send(page(pushEnabled ? '🔔 ENCENDIDOS' : '🔕 APAGADOS')));

app.get('*', (_q, r) => r.sendFile(path.join(WWW, 'index.html')));
app.listen(PORT, () => console.log(`[Server] STOCK STORE en puerto ${PORT}`));

// ── Firebase REST ───────────────────────────────────────────────────────
function fbGet(p) {
    return new Promise((resolve) => {
        https.get(`${DB_BASE}/${p}.json`, (res) => {
            let b = ''; res.on('data', c => b += c);
            res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
        }).on('error', () => resolve(null));
    });
}
function fbReq(method, p, value) {
    return new Promise((resolve) => {
        const data = value === undefined ? null : JSON.stringify(value);
        const req = https.request(`${DB_BASE}/${p}.json`, { method, headers: { 'Content-Type': 'application/json' } }, (res) => {
            res.resume(); res.on('end', () => resolve(true));
        });
        req.on('error', () => resolve(false));
        if (data) req.write(data);
        req.end();
    });
}
const fbPut = (p, v) => fbReq('PUT', p, v);
const fbDelete = (p) => fbReq('DELETE', p);

// Escucha en tiempo real por Server-Sent Events (sin credenciales de administrador)
function listen(p, handlers, qs) {
    const url = `${DB_BASE}/${p}.json${qs ? '?' + qs : ''}`;
    const req = https.get(url, { headers: { Accept: 'text/event-stream' } }, (res) => {
        console.log(`[Firebase] Escuchando ${p}`);
        let buf = '';
        res.on('data', (chunk) => {
            buf += chunk.toString();
            let i;
            while ((i = buf.indexOf('\n\n')) !== -1) {
                const raw = buf.slice(0, i); buf = buf.slice(i + 2);
                const ev = (raw.match(/^event:\s*(.*)$/m) || [])[1];
                const dl = (raw.match(/^data:\s*(.*)$/m) || [])[1];
                if (!ev || !dl || ev === 'keep-alive') continue;
                let payload; try { payload = JSON.parse(dl); } catch { continue; }
                if (!payload) continue;
                const pth = payload.path || '/'; const data = payload.data;
                if (pth === '/') { handlers.onInitial && handlers.onInitial(data || {}); continue; }
                const parts = pth.replace(/^\//, '').split('/');
                handlers.onChild && handlers.onChild(parts[0], parts.length === 1 ? data : undefined, parts.slice(1), data);
            }
        });
        res.on('end', () => { console.log(`[Firebase] ${p} cerrado, reconectando…`); setTimeout(() => listen(p, handlers, qs), 3000); });
    });
    req.on('error', (e) => { console.error(`[Firebase] error ${p}:`, e.message); setTimeout(() => listen(p, handlers, qs), 5000); });
}

// ── Suscripciones ───────────────────────────────────────────────────────
let subs = {};
listen(`${ROOT}/push`, {
    onInitial: (d) => { subs = {}; for (const [k, v] of Object.entries(d || {})) { try { subs[k] = JSON.parse(v); } catch {} } console.log(`[WebPush] ${Object.keys(subs).length} suscripciones`); },
    onChild: (k, v) => { if (v == null) delete subs[k]; else { try { subs[k] = JSON.parse(v); } catch {} } }
});

// ── Presencia: si la otra persona ya está viendo el chat, no se le avisa ──
const presence = {};
listen(`${ROOT}/presence`, {
    onInitial: (d) => Object.assign(presence, d || {}),
    onChild: (k, v, rest, raw) => { if (v !== undefined) presence[k] = v; else if (rest.length) presence[k] = { ...(presence[k] || {}), [rest[0]]: raw }; }
});
const isViewing = (id) => { const p = presence[id]; return !!(p && p.online && p.ts && Date.now() - p.ts < 25000); };

// ── Textos camuflados (rotan para que no se vean siempre iguales) ───────
const PROMOS = [
    ['🛒 STOCK STORE', 'Un artículo de tu carrito bajó de precio. ¡Míralo ahora!'],
    ['⚡ Oferta relámpago', 'Descuentos de hasta 80% por tiempo limitado.'],
    ['🎁 STOCK STORE', 'Tienes un cupón disponible. Úsalo antes de que venza.'],
    ['🔥 STOCK STORE', 'Los más vendidos de hoy están casi agotados.'],
    ['📦 STOCK STORE', 'Nuevos artículos con envío gratis te están esperando.'],
    ['💸 Precio especial', 'Alguien más está viendo tu artículo. ¡No te lo pierdas!']
];
let promoIdx = Math.floor(Math.random() * PROMOS.length);

async function notifyOthers(senderId) {
    if (!pushReady || !pushEnabled) return;
    const [title, body] = PROMOS[promoIdx++ % PROMOS.length];
    const payload = JSON.stringify({ title, body, tag: 'stockstore-msg' });
    for (const [uid, sub] of Object.entries(subs)) {
        if (uid === senderId) continue;
        if (isViewing(uid)) { console.log(`[WebPush] ${uid} está en el chat — no se avisa`); continue; }
        try { await webpush.sendNotification(sub, payload, { TTL: 3600, urgency: 'high' }); console.log(`[WebPush] ✓ ${uid}`); }
        catch (err) {
            console.warn(`[WebPush] ✗ ${uid}: ${err.statusCode || ''} ${err.body || err.message}`);
            if (err.statusCode === 404 || err.statusCode === 410) { delete subs[uid]; fbDelete(`${ROOT}/push/${uid}`); }
        }
    }
}

// ── Mensajes nuevos (una ráfaga = un solo aviso) ─────────────────────────
const START = Date.now();
const seen = new Set();
const timers = {};
listen(`${ROOT}/messages`, {
    onInitial: (d) => Object.keys(d || {}).forEach(k => seen.add(k)),
    onChild: (key, msg) => {
        if (!msg || !msg.from || seen.has(key)) return;
        seen.add(key);
        if (!msg.ts || msg.ts < START) return;
        clearTimeout(timers[msg.from]);
        timers[msg.from] = setTimeout(() => { delete timers[msg.from]; notifyOthers(msg.from); }, 2500);
    }
}, 'orderBy=%22$key%22&limitToLast=20');
