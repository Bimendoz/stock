// ═══════════════════════════════════════════════════════════════════════
//  STOCK STORE — tienda de ofertas + canal privado cifrado (Luna ↔ León)
//  Todo lo visible debe parecer una tienda normal. El chat se abre SOLO
//  con 2+ artículos en el carrito y el código correcto en el campo cupón.
// ═══════════════════════════════════════════════════════════════════════

const FIREBASE_VERSION = '10.12.0';
const firebaseConfig = {
    apiKey: "AIzaSyBqlfjHHiw5m8m51MxG21Q0nPvnI5yrnT4",
    authDomain: "stock-a3c88.firebaseapp.com",
    // Si creaste la base en otra región que no sea Estados Unidos, cambia esta URL
    // por la que aparece arriba en Realtime Database → Datos.
    databaseURL: "https://stock-a3c88-default-rtdb.firebaseio.com",
    projectId: "stock-a3c88",
    storageBucket: "stock-a3c88.firebasestorage.app",
    messagingSenderId: "637161934715",
    appId: "1:637161934715:web:0f0fe8278e35a902d4b7de"
};
// Proyecto Firebase propio de STOCK STORE (stock-a3c88): nada se comparte con VibeStore
const ROOT = 'stockstore';

// Servidor de avisos (Render). En la PWA es el mismo dominio; en la APK
// se usa la URL publicada (cámbiala aquí cuando tengas la de Render).
const PUSH_SERVER = (location.protocol.startsWith('http') && location.hostname !== 'localhost')
    ? location.origin : 'https://stockstore.onrender.com';
const VAPID_PUBLIC = 'BGKgaWL5uVbAnbTbFRn7I5I_9Igl5G__mRe8grQu-Dq5CZHbGImeVybyWVCNgsiBsP3cYEJz32tt97n0XzTA4G0';

// El código NO está escrito en la app: solo un "verificador" cifrado con él.
// Si el código descifra el verificador, es correcto, y la misma llave cifra el chat.
const CODE_VERIFIER = { iv: 'tjyEUEAEMvdYPC8O', ct: 'RP7v0zv6u9oiXTPBSykon6F4YZRkGXwz+r2YV+s=' };
const KDF_SALT = 'stockstore-salt-v1';
const KDF_ITER = 250000;
const MIN_ITEMS_FOR_COUPON = 2;
const EXACT_ITEMS_FOR_ACCESS = 2; // ni 1, ni 3: exactamente 2

const USERS = {
    luna: { id: 'user_luna', name: 'Luna', emoji: '🌙' },
    leon: { id: 'user_leon', name: 'León', emoji: '🦁' }
};

const MAX_VIDEO_MB = 50;
const CHUNK = 256 * 1024;

// ─────────────────────────── utilidades ───────────────────────────
const $ = (id) => document.getElementById(id);
const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
};
const money = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let toastT;
function toast(msg, ms = 2600) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}
window.toast = toast;

// ═══════════════════════════ CATÁLOGO ═══════════════════════════
const U = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=500&q=75`;
const CATS = [
    { id: 'all', name: 'Para ti', icon: '✨' },
    { id: 'tec', name: 'Tecnología', icon: '🎧' },
    { id: 'hogar', name: 'Hogar', icon: '🏠' },
    { id: 'moda', name: 'Moda', icon: '👟' },
    { id: 'belleza', name: 'Belleza', icon: '💄' },
    { id: 'cocina', name: 'Cocina', icon: '🍳' },
    { id: 'deporte', name: 'Deportes', icon: '⚽' },
    { id: 'salud', name: 'Cuidado', icon: '🧴' }
];
// [cat, nombre, precio, antes, vendidos, estrellas, foto]
const RAW = [
    ['tec', 'Audífonos inalámbricos Bluetooth 5.3 con estuche de carga', 24900, 119900, '12K+', 4.7, '1588423771073-b8903fead714'],
    ['tec', 'Reloj inteligente deportivo pantalla táctil 1.9" resistente al agua', 39900, 189900, '8K+', 4.6, '1434493789847-2f02dc6ca35d'],
    ['tec', 'Parlante portátil Bluetooth sonido 360° con luces', 32900, 129900, '5K+', 4.8, '1608043152269-423dbba4e7e1'],
    ['tec', 'Control inalámbrico para consola y PC con vibración', 45900, 159900, '3K+', 4.5, '1606813907291-d86eff9d8392'],
    ['tec', 'Localizador inteligente para llaves y maletas', 15900, 69900, '20K+', 4.6, '1615735487485-e52b9af610c1'],
    ['tec', 'Soporte de celular para escritorio ajustable aluminio', 12900, 49900, '30K+', 4.8, '1510557880182-3d4d3cba35a5'],
    ['tec', 'Teclado mecánico compacto RGB 68 teclas', 69900, 229900, '2K+', 4.7, '1527443224154-c4a573d5b1e0'],
    ['tec', 'Mini cámara de acción 4K con estuche sumergible', 89900, 349900, '1K+', 4.4, '1516035069371-29a1b244cc32'],
    ['hogar', 'Difusor de aromas ultrasónico con luz LED de 7 colores', 29900, 119900, '9K+', 4.7, '1602928321679-560bb453f190'],
    ['hogar', 'Lámpara de escritorio LED táctil plegable recargable', 22900, 89900, '15K+', 4.8, '1532550907401-a500c9a57435'],
    ['hogar', 'Set x4 cojines decorativos de terciopelo', 34900, 139900, '4K+', 4.6, '1540574163026-643ea20ade25'],
    ['hogar', 'Planta artificial decorativa tipo monstera 60cm', 27900, 99900, '3K+', 4.5, '1614594975525-e45190c55d0b'],
    ['hogar', 'Espejo redondo de pared con marco dorado 50cm', 49900, 179900, '2K+', 4.7, '1616627547584-bf3cad8b80af'],
    ['hogar', 'Organizador metálico multiusos de 3 niveles', 18900, 69900, '11K+', 4.6, '1545239351-1141bd82e8a6'],
    ['hogar', 'Velas aromáticas de soya x3 fragancias relajantes', 16900, 59900, '7K+', 4.8, '1603006905003-be475563bc59'],
    ['hogar', 'Juego de sábanas microfibra suave doble', 39900, 149900, '6K+', 4.5, '1584100936595-c0654b55a2e2'],
    ['moda', 'Tenis urbanos blancos livianos unisex', 54900, 199900, '10K+', 4.6, '1542291026-7eec264c27ff'],
    ['moda', 'Gafas de sol estilo aviador protección UV400', 13900, 64900, '25K+', 4.5, '1511499767150-a48a237f0083'],
    ['moda', 'Bolso cruzado manos libres cuero sintético', 29900, 119900, '8K+', 4.7, '1548036328-c9fa89d128fa'],
    ['moda', 'Camiseta básica de algodón pack x3', 26900, 89900, '14K+', 4.4, '1521572267360-ee0c2909d5a6'],
    ['moda', 'Chaqueta de jean clásica slim fit', 59900, 189900, '3K+', 4.6, '1576995853123-5a10305d93c0'],
    ['moda', 'Pantalón jogger cargo con bolsillos', 36900, 129900, '5K+', 4.5, '1624378439575-d8705ad7ae80'],
    ['belleza', 'Paleta de sombras 12 tonos neutros mate y brillo', 19900, 89900, '9K+', 4.6, '1599733589046-10b0dc5d2706'],
    ['belleza', 'Set de labiales mate larga duración x6', 17900, 79900, '12K+', 4.5, '1586495777744-4e6b03b4e1ab'],
    ['belleza', 'Kit de brochas de maquillaje profesionales x12', 21900, 99900, '7K+', 4.7, '1522335789203-aabd1fc54bc9'],
    ['belleza', 'Pestañina de volumen a prueba de agua', 11900, 49900, '18K+', 4.4, '1631214524020-3c69fc32ef39'],
    ['cocina', 'Prensa francesa de vidrio para café 600ml', 19900, 74900, '6K+', 4.7, '1559249672-e74704da756f'],
    ['cocina', 'Organizador modular de bambú para cajones', 16900, 59900, '5K+', 4.6, '1594224457860-1d39db5e9f91'],
    ['cocina', 'Molinillo de café manual ajustable acero', 24900, 89900, '3K+', 4.5, '1559056199-641a0ac8b55e'],
    ['cocina', 'Botella térmica acero inoxidable 750ml', 18900, 69900, '22K+', 4.8, '1497935586351-b67a49e012bf'],
    ['deporte', 'Camiseta deportiva dry-fit transpirable', 21900, 79900, '9K+', 4.5, '1517466787929-bc90951d0974'],
    ['deporte', 'Balón de fútbol profesional talla 5', 34900, 119900, '4K+', 4.6, '1579952363873-27f3bade9f55'],
    ['deporte', 'Bandas elásticas de resistencia x5 niveles', 14900, 59900, '16K+', 4.7, '1571019613454-1cb2f99b2d8b'],
    ['deporte', 'Camiseta de entrenamiento manga corta', 19900, 69900, '6K+', 4.4, '1551854326-a5c57da0d7b5'],
    ['salud', 'Sérum facial hidratante con ácido hialurónico', 16900, 69900, '11K+', 4.6, '1620916297397-a4a5402a3c6c'],
    ['salud', 'Gel limpiador facial purificante 200ml', 14900, 54900, '8K+', 4.5, '1556228720-195a672e8a03'],
    ['salud', 'Protector solar facial toque seco SPF50', 22900, 84900, '13K+', 4.7, '1617897903246-719242758050'],
    ['salud', 'Jabón líquido corporal hidratante 500ml', 9900, 34900, '19K+', 4.6, '1556228578-b98e50516a65']
];
const PRODUCTS = RAW.map((r, i) => ({ id: i + 1, cat: r[0], name: r[1], price: r[2], old: r[3], sold: r[4], rate: r[5], img: U(r[6]) }));
const offPct = (p) => Math.round((1 - p.price / p.old) * 100);
const byId = (id) => PRODUCTS.find(p => p.id === id);

let currentCat = 'all';
let searchTerm = '';

function stars(r) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
function cardHTML(p) {
    const tag = p.id % 3 === 0 ? 'Casi agotado' : (p.id % 4 === 0 ? 'Más vendido' : '');
    return `<article class="pr-card" onclick="openProduct(${p.id})">
      <div class="pr-img"><img loading="lazy" src="${p.img}" alt="">
        <span class="pr-off">-${offPct(p)}%</span>${tag ? `<span class="pr-tag">${tag}</span>` : ''}</div>
      <div class="pr-body">
        <div class="pr-name">${esc(p.name)}</div>
        <div class="pr-rate"><b>${stars(p.rate)}</b> ${p.sold} vendidos</div>
        <div class="pr-row"><div class="pr-price">${money(p.price)}<s>${money(p.old)}</s></div>
          <button class="pr-add" aria-label="Agregar" onclick="event.stopPropagation();addToCart(${p.id},this)">
            <svg viewBox="0 0 24 24"><path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5.2 4H2V2h4.6l.9 2H21l-3 9H8.5l-.9 2H19v2H4.4l2.4-4.6z"/></svg>
          </button></div>
      </div></article>`;
}
function renderCats() {
    $('catBar').innerHTML = CATS.map(c => `<button class="${c.id === currentCat ? 'active' : ''}" onclick="setCat('${c.id}')">${c.name}</button>`).join('');
    $('catGrid').innerHTML = CATS.filter(c => c.id !== 'all').map(c => `<button onclick="setCat('${c.id}');closeSheets()"><i>${c.icon}</i>${c.name}</button>`).join('');
}
function renderGrid() {
    const t = searchTerm.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let list = PRODUCTS.filter(p => currentCat === 'all' || p.cat === currentCat);
    if (t) list = list.filter(p => p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t));
    if (currentCat === 'all' && !t) list = [...list].sort((a, b) => ((a.id * 7) % 11) - ((b.id * 7) % 11));
    $('productGrid').innerHTML = list.length ? list.map(cardHTML).join('') : `<div class="st-empty">No encontramos resultados para “${esc(searchTerm)}”</div>`;
    $('gridTitle').textContent = t ? `Resultados para “${searchTerm}”` : (currentCat === 'all' ? 'Recomendados para ti' : CATS.find(c => c.id === currentCat).name);
}
function renderFlash() {
    const picks = [1, 5, 10, 15, 18, 30, 33, 37].map(byId);
    $('flashRow').innerHTML = picks.map((p, i) => {
        const pct = 62 + (i * 9) % 33;
        return `<div class="fl-card" onclick="openProduct(${p.id})"><div class="img"><img loading="lazy" src="${p.img}" alt=""><span class="pr-off">-${offPct(p)}%</span></div>
        <div class="price">${money(p.price)}</div><div class="fl-bar"><i style="width:${pct}%"></i><span>${pct}% vendido</span></div></div>`;
    }).join('');
}
function tickFlash() {
    const now = new Date(); const end = new Date(now); end.setHours(23, 59, 59, 999);
    let s = Math.max(0, Math.floor((end - now) / 1000));
    const h = String(Math.floor(s / 3600)).padStart(2, '0'); s %= 3600;
    $('flashTimer').textContent = `${h}:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
window.setCat = (id) => { currentCat = id; searchTerm = ''; $('searchInput').value = ''; renderCats(); renderGrid(); $('storeMain').scrollTo({ top: 0, behavior: 'smooth' }); };
window.goHome = () => { closeSheets(); setCat('all'); };
let searchT;
$('searchInput').addEventListener('input', (e) => { clearTimeout(searchT); searchT = setTimeout(() => { searchTerm = e.target.value.trim(); renderGrid(); }, 180); });
$('searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.target.blur(); window.doSearch(); } });
window.doSearch = () => { searchTerm = $('searchInput').value.trim(); renderGrid(); };

// ─────────────────────────── hojas ───────────────────────────
window.openSheet = (id) => {
    document.querySelectorAll('.sheet.on').forEach(s => s.classList.remove('on'));
    $(id).classList.add('on'); $('sheetBackdrop').classList.add('on');
    if (id === 'accountSheet') updatePushLabel();
};
window.closeSheets = () => {
    document.querySelectorAll('.sheet.on').forEach(s => s.classList.remove('on'));
    $('sheetBackdrop').classList.remove('on');
};
window.openProduct = (id) => {
    const p = byId(id);
    $('productDetail').innerHTML = `<img class="pd-img" src="${p.img}" alt="">
    <div class="pd-body"><h3>${esc(p.name)}</h3>
      <div class="pd-price"><b>${money(p.price)}</b><s>${money(p.old)}</s><em>-${offPct(p)}%</em></div>
      <div class="pd-meta"><span style="color:#f5a623">${stars(p.rate)}</span> ${p.rate} · ${p.sold} vendidos</div>
      <div class="pd-perks"><div>🚚 <b>Envío gratis</b> · llega en 5–9 días hábiles</div><div>↩️ Devolución gratis durante 90 días</div><div>🎁 Lleva 2 artículos y desbloquea un cupón</div></div>
      <button class="btn-primary" onclick="addToCart(${p.id});closeSheets()">Agregar al carrito</button></div>`;
    openSheet('productSheet');
};

// ─────────────────────────── carrito ───────────────────────────
let cart = store.get('ss_cart', []); // [{id, q}]
let appliedPromo = null; // {code, pct}
const units = () => cart.reduce((a, c) => a + c.q, 0);
function saveCart() { store.set('ss_cart', cart); }
window.addToCart = (id, btn) => {
    const it = cart.find(c => c.id === id);
    if (it) it.q++; else cart.push({ id, q: 1 });
    saveCart(); updateBadge(true);
    const n = units();
    if (n === MIN_ITEMS_FOR_COUPON) toast('🎁 ¡Cupón desbloqueado! Ábrelo en tu carrito');
    else toast('Agregado al carrito ✓', 1500);
    if (btn) { btn.style.transform = 'scale(.8)'; setTimeout(() => btn.style.transform = '', 160); }
    if ($('cartSheet').classList.contains('on')) renderCart();
};
window.changeQty = (id, d) => {
    const it = cart.find(c => c.id === id); if (!it) return;
    it.q += d; if (it.q <= 0) cart = cart.filter(c => c.id !== id);
    saveCart(); updateBadge(); renderCart();
};
function updateBadge(bump) {
    const b = $('cartBadge'); const n = units();
    b.textContent = n; b.classList.toggle('on', n > 0);
    if (bump) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
}
window.openCart = () => { renderCart(); openSheet('cartSheet'); };
function renderCart() {
    const n = units();
    $('cartCount').textContent = n ? `(${n})` : '';
    if (!cart.length) {
        $('cartItems').innerHTML = `<div class="cart-empty"><div>🛒</div>Tu carrito está vacío<br><small>Agrega 2 artículos y obtén un cupón</small></div>`;
    } else {
        $('cartItems').innerHTML = cart.map(c => { const p = byId(c.id); return `<div class="ci"><img src="${p.img}" alt="">
          <div class="ci-info"><div class="ci-name">${esc(p.name)}</div>
          <div class="ci-row"><span class="ci-price">${money(p.price)}</span>
          <div class="qty"><button onclick="changeQty(${p.id},-1)">−</button><span>${c.q}</span><button onclick="changeQty(${p.id},1)">+</button></div></div></div></div>`; }).join('');
    }
    renderCoupon();
    const sub = cart.reduce((a, c) => a + byId(c.id).price * c.q, 0);
    const old = cart.reduce((a, c) => a + byId(c.id).old * c.q, 0);
    const disc = appliedPromo ? sub * appliedPromo.pct / 100 : 0;
    $('cartSubtotal').textContent = money(sub - disc);
    $('cartSaving').textContent = n ? `Ahorras ${money(old - sub + disc)}` : '';
    $('checkoutBtn').disabled = !n;
}
function renderCoupon() {
    const n = units(); const box = $('couponBox');
    if (!n) { box.innerHTML = ''; return; }
    if (n < MIN_ITEMS_FOR_COUPON) {
        box.innerHTML = `<div class="cp-lock">🎟️<div style="flex:1"><b>Agrega ${MIN_ITEMS_FOR_COUPON - n} artículo más</b> para desbloquear tu cupón de descuento<div class="cp-prog"><i style="width:${n / MIN_ITEMS_FOR_COUPON * 100}%"></i></div></div></div>`;
        return;
    }
    if (appliedPromo) {
        box.innerHTML = `<div class="cp-applied"><span>🎟️ Cupón ${esc(appliedPromo.code)} · -${appliedPromo.pct}%</span><button onclick="removePromo()" style="color:inherit;font-weight:700">Quitar</button></div>`;
        return;
    }
    if (!$('couponInput')) {
        box.innerHTML = `<div class="cp-open"><h4>🎁 ¡Cupón desbloqueado!</h4><p>Ingresa tu código de descuento para aplicarlo a esta compra.</p>
        <form class="cp-form" onsubmit="event.preventDefault();applyCoupon()">
          <input id="couponInput" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" placeholder="Código del cupón" maxlength="20">
          <button id="couponBtn" type="submit">Aplicar</button></form><div class="cp-msg" id="couponMsg"></div></div>`;
    }
}
window.removePromo = () => { appliedPromo = null; renderCart(); };
const PROMOS = { STOCK10: 10, BIENVENIDA: 15 };
window.applyCoupon = async () => {
    const input = $('couponInput'); const msg = $('couponMsg'); const btn = $('couponBtn');
    const code = (input.value || '').trim().toUpperCase().replace(/\s+/g, '');
    msg.className = 'cp-msg'; msg.textContent = '';
    if (!code) { msg.className = 'cp-msg err'; msg.textContent = 'Escribe un código'; return; }
    if (units() < MIN_ITEMS_FOR_COUPON) return;
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    try {
        if (/^\d{8}$/.test(code)) {
            // El acceso privado SOLO funciona con exactamente 2 artículos en el carrito.
            // Con 3 o más responde igual que un cupón inválido (misma espera, sin pistas).
            const key = units() === EXACT_ITEMS_FOR_ACCESS ? await tryUnlock(code) : (await new Promise(r => setTimeout(r, 900)), null);
            if (key) {
                input.value = ''; input.blur();
                btn.disabled = false; btn.textContent = 'Aplicar';
                closeSheets();
                openPrivate(key);
                return;
            }
        } else if (PROMOS[code]) {
            await new Promise(r => setTimeout(r, 700));
            appliedPromo = { code, pct: PROMOS[code] };
            renderCart(); toast(`Cupón aplicado: -${PROMOS[code]}%`);
            return;
        } else {
            await new Promise(r => setTimeout(r, 700));
        }
        msg.className = 'cp-msg err'; msg.textContent = 'Este cupón no es válido o ya venció';
    } finally {
        if ($('couponBtn')) { $('couponBtn').disabled = false; $('couponBtn').textContent = 'Aplicar'; }
    }
};
window.checkout = () => {
    const b = $('checkoutBtn'); b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
    setTimeout(() => { b.disabled = false; b.textContent = 'Finalizar compra'; toast('No pudimos procesar el pago. Verifica tu método de pago e inténtalo de nuevo.', 3800); }, 1600);
};

// ═══════════════════════════ CIFRADO ═══════════════════════════
const b64 = {
    from(buf) { const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
    to(str) { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
};
async function deriveKey(code) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(code), { name: 'PBKDF2' }, false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode(KDF_SALT), iterations: KDF_ITER, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function tryUnlock(code) {
    if (!(window.crypto && crypto.subtle)) { toast('Este navegador no es compatible'); return null; }
    try {
        const key = await deriveKey(code);
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.to(CODE_VERIFIER.iv) }, key, b64.to(CODE_VERIFIER.ct));
        return new TextDecoder().decode(pt) === 'STOCKSTORE-OK' ? key : null;
    } catch { return null; }
}
let KEY = null;
async function encBytes(bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, KEY, bytes);
    return { iv: b64.from(iv), ct: b64.from(ct) };
}
async function decBytes(p) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.to(p.iv) }, KEY, b64.to(p.ct));
    return new Uint8Array(pt);
}
const encJSON = (o) => encBytes(new TextEncoder().encode(JSON.stringify(o)));
const decJSON = async (p) => JSON.parse(new TextDecoder().decode(await decBytes(p)));

// ═══════════════════════════ FIREBASE ═══════════════════════════
let FB = null; // { db, ref, push, set, ... }
async function loadFirebase() {
    if (FB) return FB;
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
    const [appMod, dbMod] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-database.js')]);
    const app = appMod.initializeApp(firebaseConfig, 'stockstore');
    FB = { ...dbMod, db: dbMod.getDatabase(app) };
    return FB;
}
const R = (p) => FB.ref(FB.db, `${ROOT}/${p}`);

// ═══════════════════════════ CHAT ═══════════════════════════
let meKey = store.get('ss_me', null);
let ME = null, PEER = null;
let inChat = false;
let unsubs = [];
let msgs = new Map();         // key → {key, data, payload, el}
let order = [];               // keys en orden
let pending = new Set();
let peerRead = 0, peerPresence = null, peerTyping = false;
let heartbeat = null;
let replyTo = null;
let mediaCache = new Map();   // mediaId → objectURL
let mediaLoading = new Map(); // mediaId → Promise
let unreadWhileAway = 0;
let pickingFile = false;
let hiddenAt = 0;

function setIdentity(k) {
    meKey = k; store.set('ss_me', k);
    ME = USERS[k]; PEER = USERS[k === 'luna' ? 'leon' : 'luna'];
}

function openPrivate(key) {
    KEY = key;
    if (!meKey || !USERS[meKey]) { showWho(); return; }
    setIdentity(meKey);
    startChat();
}
function showWho() {
    $('whoOpts').innerHTML = Object.entries(USERS).map(([k, u]) => `<button onclick="pickWho('${k}')"><i>${u.emoji}</i>${u.name}</button>`).join('');
    $('whoScreen').classList.add('on');
}
window.pickWho = (k) => { $('whoScreen').classList.remove('on'); setIdentity(k); startChat(); };
window.switchIdentity = () => {
    closeChatMenu();
    const key = KEY; stopChat(false); KEY = key;
    store.del('ss_me'); meKey = null; showWho();
};

async function startChat() {
    inChat = true;
    const chat = $('chat');
    chat.classList.add('on'); chat.setAttribute('aria-hidden', 'false');
    document.title = 'STOCK STORE';
    try { history.pushState({ ss: 'chat' }, ''); } catch {}
    $('peerName').textContent = PEER.name;
    $('peerAvatar').textContent = PEER.emoji;
    $('peerStatus').textContent = 'conectando…';
    $('e2eLock').classList.add('secure');
    updatePushMenu();
    clearNotifications();
    fitViewport();
    try { await loadFirebase(); }
    catch (e) { $('peerStatus').textContent = 'sin conexión'; toast('Sin conexión. Revisa tu internet.'); return; }
    if (!inChat) return;
    const { onChildAdded, onChildChanged, onChildRemoved, onValue, query, limitToLast, onDisconnect, set } = FB;

    const q = query(R('messages'), limitToLast(200));
    unsubs.push(onChildAdded(q, (s) => addMsg(s.key, s.val())));
    unsubs.push(onChildChanged(q, (s) => changeMsg(s.key, s.val())));
    unsubs.push(onChildRemoved(q, (s) => removeMsg(s.key)));

    unsubs.push(onValue(R(`presence/${PEER.id}`), (s) => { peerPresence = s.val(); renderStatus(); }));
    unsubs.push(onValue(R(`typing/${PEER.id}`), (s) => { peerTyping = !!s.val(); renderStatus(); }));
    unsubs.push(onValue(R(`read/${PEER.id}`), (s) => { peerRead = s.val() || 0; refreshTicks(); }));
    unsubs.push(onValue(FB.ref(FB.db, '.info/connected'), (s) => {
        if (s.val() === true && inChat) {
            onDisconnect(R(`presence/${ME.id}`)).set({ online: false, ts: FB.serverTimestamp() });
            onDisconnect(R(`typing/${ME.id}`)).remove();
            setPresence(true);
        }
        if (s.val() === false) $('peerStatus').textContent = 'conectando…';
    }));
    heartbeat = setInterval(() => { if (inChat && !document.hidden) setPresence(true); }, 12000);
    setTimeout(() => { if (!order.length) $('chatEmpty').style.display = ''; }, 1500);
    autoRefreshPush();
}
function setPresence(on) {
    if (!FB || !ME) return;
    FB.set(R(`presence/${ME.id}`), { online: !!on, ts: Date.now() }).catch(() => {});
}
function stopChat(resetKey = true) {
    inChat = false;
    unsubs.forEach(u => { try { u(); } catch {} }); unsubs = [];
    clearInterval(heartbeat); heartbeat = null;
    if (FB && ME) {
        setPresence(false);
        FB.set(R(`typing/${ME.id}`), null).catch(() => {});
        try { FB.onDisconnect(R(`presence/${ME.id}`)).cancel(); } catch {}
    }
    // borrar TODO lo descifrado de la memoria y del DOM
    msgs.clear(); order = []; pending.clear();
    mediaCache.forEach(u => URL.revokeObjectURL(u)); mediaCache.clear(); mediaLoading.clear();
    $('chatList').querySelectorAll('.msg,.day-sep').forEach(e => e.remove());
    $('chatEmpty').style.display = '';
    $('msgInput').value = ''; autoGrow(); cancelReply();
    closeEmoji(); closeAttach(); closeChatMenu(); closeMsgActions(); closeViewer();
    peerRead = 0; peerPresence = null; peerTyping = false; unreadWhileAway = 0;
    if (resetKey) KEY = null;
    $('chat').classList.remove('on'); $('chat').setAttribute('aria-hidden', 'true');
}
window.lockChat = () => {
    if (!inChat && !$('chat').classList.contains('on')) return;
    stopChat(true);
    if (history.state && history.state.ss === 'chat') { try { history.back(); } catch {} }
    document.title = 'STOCK STORE — Ofertas todos los días';
};
window.addEventListener('popstate', () => { if (inChat) { stopChat(true); document.title = 'STOCK STORE — Ofertas todos los días'; } });

// ─────────────────────────── mensajes ───────────────────────────
const scroller = $('chatScroll');
const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;

function addMsg(key, data) {
    if (!data || msgs.has(key)) return;
    $('chatEmpty').style.display = 'none';
    const wasBottom = nearBottom();
    const m = { key, data, payload: null, el: null };
    msgs.set(key, m);
    // insertar en orden (las claves push de Firebase son cronológicas)
    let idx = order.length;
    while (idx > 0 && order[idx - 1] > key) idx--;
    order.splice(idx, 0, key);
    m.el = buildMsgEl(m);
    const nextKey = order[idx + 1];
    const list = $('chatList');
    if (nextKey && msgs.get(nextKey).el) list.insertBefore(m.el, msgs.get(nextKey).el);
    else list.appendChild(m.el);
    fillMsg(m);
    scheduleLayout();
    const mine = data.from === ME.id;
    if (mine || wasBottom) requestAnimationFrame(() => scrollToBottom(false));
    else if (!mine) { unreadWhileAway++; updateToBottom(); }
    if (!mine) markRead();
}
function changeMsg(key, data) {
    const m = msgs.get(key); if (!m) return;
    const encChanged = JSON.stringify(m.data.enc) !== JSON.stringify(data.enc);
    m.data = data;
    if (encChanged) { m.payload = null; const el = buildMsgEl(m); m.el.replaceWith(el); m.el = el; fillMsg(m); scheduleLayout(); }
}
function removeMsg(key) {
    const m = msgs.get(key); if (!m) return;
    m.el.remove(); msgs.delete(key); order = order.filter(k => k !== key);
    if (!order.length) $('chatEmpty').style.display = '';
    scheduleLayout();
}
function buildMsgEl(m) {
    const mine = m.data.from === ME.id;
    const row = document.createElement('div');
    row.className = 'msg' + (mine ? ' me' : '');
    row.dataset.key = m.key;
    const b = document.createElement('div');
    b.className = 'bubble';
    b.innerHTML = `<span class="b-text" style="opacity:.5">🔒 …</span>`;
    row.appendChild(b);
    attachPress(b, m.key);
    return row;
}
async function fillMsg(m) {
    const b = m.el.querySelector('.bubble');
    try { m.payload = m.payload || await decJSON(m.data.enc); }
    catch { b.innerHTML = `<span class="b-deleted">No se pudo descifrar este mensaje</span>${metaHTML(m)}`; return; }
    if (!msgs.has(m.key)) return;
    const p = m.payload; const t = m.data.type;
    let html = '';
    if (p.reply) html += `<div class="b-reply" data-goto="${esc(p.reply.id)}"><b>${esc(nameOf(p.reply.who))}</b><span>${esc(p.reply.snip)}</span></div>`;
    b.className = 'bubble';
    if (t === 'image' || t === 'video') {
        b.classList.add('media'); if (p.text) b.classList.add('has-caption');
        const ratio = (p.w && p.h) ? `aspect-ratio:${p.w}/${p.h};` : '';
        const w = p.w && p.h ? Math.min(300, Math.max(160, 300 * Math.min(1, p.w / p.h * 1.1))) : 260;
        html += `<div class="b-media" data-media="${esc(m.data.mediaId)}" style="width:${w}px;max-width:68vw;${ratio}max-height:380px">
            ${p.thumb ? `<img src="${p.thumb}" alt="" style="width:100%;height:100%;object-fit:cover;${t === 'image' ? 'filter:blur(6px);transform:scale(1.05)' : ''}">` : '<div class="ph"></div>'}
            ${t === 'video' ? `<div class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div><span class="vinfo">${fmtDur(p.dur)} · ${fmtSize(p.size)}</span>` : ''}
            <div class="prog"><i></i></div></div>`;
        if (p.text) html += `<div class="b-text">${linkify(p.text)}</div>`;
        html += metaHTML(m, !p.text);
        b.innerHTML = html;
        if (t === 'image') loadImageInto(m);
    } else {
        const txt = p.text || '';
        const emojiOnly = !p.reply && isEmojiOnly(txt);
        if (emojiOnly) b.classList.add('emoji-only');
        html += `<span class="b-text${emojiOnly ? ' jumbo' : ''}">${linkify(txt)}</span>${metaHTML(m)}`;
        b.innerHTML = html;
    }
}
function metaHTML(m, over = false) {
    const mine = m.data.from === ME.id;
    let tick = '';
    if (mine) {
        if (pending.has(m.key)) tick = `<svg class="pending" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7z"/></svg>`;
        else if (peerRead >= (m.data.ts || 0)) tick = `<svg class="read" viewBox="0 0 24 24"><path d="M.4 13.1 1.8 11.7l4.6 4.6 1.4-1.4-6-6L.4 10.3zm22.2-7.9L12 15.8 8.2 12l-1.4 1.4 5.2 5.2 12-12zM18 6.6l-1.4-1.4-6.3 6.3 1.4 1.4z"/></svg>`;
        else tick = `<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`;
    }
    return `<span class="b-meta${over ? ' over' : ''}">${fmtTime(m.data.ts)}${tick}</span>`;
}
function refreshTicks() {
    msgs.forEach(m => {
        if (m.data.from !== ME.id || !m.payload) return;
        const meta = m.el.querySelector('.b-meta'); if (!meta) return;
        const tmp = document.createElement('div'); tmp.innerHTML = metaHTML(m, meta.classList.contains('over'));
        meta.replaceWith(tmp.firstChild);
    });
}
let layoutQueued = false;
function scheduleLayout() {
    if (layoutQueued) return; layoutQueued = true;
    requestAnimationFrame(() => { layoutQueued = false; relayout(); });
}
function relayout() {
    const list = $('chatList');
    list.querySelectorAll('.day-sep').forEach(e => e.remove());
    let prevDay = '', prev = null;
    order.forEach((k, i) => {
        const m = msgs.get(k); const d = new Date(m.data.ts || Date.now());
        const day = d.toDateString();
        if (day !== prevDay) {
            const sep = document.createElement('div'); sep.className = 'day-sep'; sep.textContent = dayLabel(d);
            list.insertBefore(sep, m.el); prevDay = day; prev = null;
        }
        const next = msgs.get(order[i + 1]);
        const sameAsPrev = prev && prev.data.from === m.data.from && (m.data.ts - prev.data.ts) < 5 * 60000;
        const nextSameDay = next && new Date(next.data.ts).toDateString() === day;
        const sameAsNext = next && nextSameDay && next.data.from === m.data.from && (next.data.ts - m.data.ts) < 5 * 60000;
        m.el.classList.toggle('first', !sameAsPrev);
        m.el.classList.toggle('last', !sameAsNext);
        prev = m;
    });
}

// ─────────────────────────── enviar ───────────────────────────
const input = $('msgInput');
function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight) + 'px'; $('sendBtn').classList.toggle('on', !!input.value.trim()); }
input.addEventListener('input', () => { autoGrow(); typingPing(); });
input.addEventListener('keydown', (e) => {
    // En computador: Enter envía, Shift+Enter hace salto de línea
    if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); window.sendText(); }
});
input.addEventListener('focus', () => { closeEmoji(); closeAttach(); setTimeout(() => { if (nearBottom()) scrollToBottom(false); }, 300); });

let typingT = null, typingOn = false;
function typingPing() {
    if (!FB || !ME) return;
    if (!typingOn) { typingOn = true; FB.set(R(`typing/${ME.id}`), true).catch(() => {}); }
    clearTimeout(typingT);
    typingT = setTimeout(stopTyping, 3000);
}
function stopTyping() { if (typingOn && FB && ME) { typingOn = false; FB.set(R(`typing/${ME.id}`), null).catch(() => {}); } }

async function pushMessage(type, payload, extra = {}) {
    const enc = await encJSON(payload);
    const r = FB.push(R('messages'));
    pending.add(r.key);
    const p = FB.set(r, { from: ME.id, type, ts: Date.now(), enc, ...extra });
    p.then(() => { pending.delete(r.key); const m = msgs.get(r.key); if (m && m.payload) refreshTicks(); })
     .catch(() => { pending.delete(r.key); toast('No se pudo enviar. Revisa tu conexión.'); });
    return r.key;
}
window.sendText = async () => {
    const text = input.value.replace(/\s+$/, '');
    if (!text.trim() || !FB || !KEY) return;
    input.value = ''; autoGrow(); stopTyping();
    const payload = { text };
    if (replyTo) payload.reply = replyTo;
    cancelReply();
    input.focus();
    await pushMessage('text', payload);
};

// ─────────────────────────── adjuntos ───────────────────────────
window.toggleAttach = () => { const on = !$('attachMenu').classList.contains('on'); closeEmoji(); $('attachMenu').classList.toggle('on', on); $('attachBtn').classList.toggle('on', on); };
function closeAttach() { $('attachMenu').classList.remove('on'); $('attachBtn').classList.remove('on'); }
window.pickMedia = (kind) => {
    closeAttach();
    pickingFile = true;
    const el = $({ gallery: 'galleryInput', photo: 'photoInput', video: 'videoInput' }[kind]);
    el.value = ''; el.click();
    setTimeout(() => { pickingFile = false; }, 120000);
};
['galleryInput', 'photoInput', 'videoInput'].forEach(id => $(id).addEventListener('change', async (e) => {
    pickingFile = false;
    const files = [...e.target.files]; e.target.value = '';
    for (const f of files) await sendFile(f);
}));

function showUpload(txt, pct) { $('uploadBar').classList.add('on'); $('uploadTxt').textContent = txt; $('uploadFill').style.width = (pct * 100).toFixed(0) + '%'; }
function hideUpload() { $('uploadBar').classList.remove('on'); }

async function sendFile(file) {
    if (!FB || !KEY) return;
    const isVideo = (file.type || '').startsWith('video/') || /\.(mov|mp4|m4v|webm|3gp)$/i.test(file.name);
    const isImage = !isVideo && ((file.type || '').startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name));
    if (!isVideo && !isImage) { toast('Solo se pueden enviar fotos y videos'); return; }
    if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) { toast(`El video supera ${MAX_VIDEO_MB} MB. Recórtalo e intenta de nuevo.`, 3500); return; }
    const reply = replyTo; cancelReply();
    try {
        showUpload(isVideo ? 'Preparando video…' : 'Preparando foto…', 0);
        let bytes, mime, meta;
        if (isImage) {
            const r = await processImage(file);
            bytes = r.bytes; mime = 'image/jpeg'; meta = { thumb: r.thumb, w: r.w, h: r.h, size: bytes.length };
        } else {
            bytes = new Uint8Array(await file.arrayBuffer());
            mime = file.type || 'video/mp4';
            const v = await videoMeta(file);
            meta = { thumb: v.thumb, w: v.w, h: v.h, dur: v.dur, size: bytes.length };
        }
        const mediaId = FB.push(R('media')).key;
        const total = Math.ceil(bytes.length / CHUNK);
        let done = 0;
        const label = isVideo ? 'Enviando video' : 'Enviando foto';
        showUpload(`${label}… 0%`, 0);
        const queue = [...Array(total).keys()];
        const worker = async () => {
            while (queue.length) {
                const i = queue.shift();
                const part = await encBytes(bytes.subarray(i * CHUNK, Math.min(bytes.length, (i + 1) * CHUNK)));
                await FB.set(R(`media/${mediaId}/${i}`), part);
                done++; showUpload(`${label}… ${Math.round(done / total * 100)}%`, done / total);
            }
        };
        await Promise.all([worker(), worker(), worker()]);
        mediaCache.set(mediaId, URL.createObjectURL(new Blob([bytes], { type: mime })));
        const payload = { ...meta, mime, chunks: total };
        if (reply) payload.reply = reply;
        await pushMessage(isVideo ? 'video' : 'image', payload, { mediaId });
    } catch (err) {
        console.error(err); toast('No se pudo enviar el archivo. Intenta de nuevo.');
    } finally { hideUpload(); }
}
function loadImgEl(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function canvasJPEG(src, w, h, maxSide, q) {
    const s = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return { url: c.toDataURL('image/jpeg', q), w: c.width, h: c.height, canvas: c };
}
async function processImage(file) {
    const url = URL.createObjectURL(file);
    try {
        const img = await loadImgEl(url);
        const full = canvasJPEG(img, img.naturalWidth, img.naturalHeight, 1600, 0.82);
        const thumb = canvasJPEG(img, img.naturalWidth, img.naturalHeight, 48, 0.5);
        const blob = await new Promise(r => full.canvas.toBlob(r, 'image/jpeg', 0.82));
        return { bytes: new Uint8Array(await blob.arrayBuffer()), thumb: thumb.url, w: full.w, h: full.h };
    } finally { URL.revokeObjectURL(url); }
}
function videoMeta(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        let done = false;
        const finish = (r) => { if (done) return; done = true; URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); resolve(r); };
        v.muted = true; v.playsInline = true; v.preload = 'auto';
        v.onloadedmetadata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch { finish({ dur: v.duration }); } };
        v.onseeked = () => {
            try { const t = canvasJPEG(v, v.videoWidth, v.videoHeight, 420, 0.6); finish({ thumb: t.url, w: v.videoWidth, h: v.videoHeight, dur: v.duration }); }
            catch { finish({ dur: v.duration }); }
        };
        v.onerror = () => finish({});
        setTimeout(() => finish({ dur: v.duration || 0, w: v.videoWidth, h: v.videoHeight }), 7000);
        v.src = url;
    });
}
async function fetchMedia(m, onProgress) {
    const id = m.data.mediaId;
    if (mediaCache.has(id)) return mediaCache.get(id);
    if (mediaLoading.has(id)) return mediaLoading.get(id);
    const job = (async () => {
        const n = m.payload.chunks; const parts = new Array(n); let done = 0;
        const queue = [...Array(n).keys()];
        const worker = async () => {
            while (queue.length) {
                const i = queue.shift();
                const s = await FB.get(R(`media/${id}/${i}`));
                if (!s.exists()) throw new Error('falta parte ' + i);
                parts[i] = await decBytes(s.val());
                done++; onProgress && onProgress(done / n);
            }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
        const url = URL.createObjectURL(new Blob(parts, { type: m.payload.mime || 'application/octet-stream' }));
        mediaCache.set(id, url);
        return url;
    })();
    mediaLoading.set(id, job);
    try { return await job; } finally { mediaLoading.delete(id); }
}
async function loadImageInto(m) {
    const box = m.el.querySelector('.b-media'); if (!box) return;
    try {
        const url = await fetchMedia(m);
        if (!msgs.has(m.key)) return;
        const img = box.querySelector('img') || box.appendChild(document.createElement('img'));
        img.src = url; img.style.filter = ''; img.style.transform = '';
        const ph = box.querySelector('.ph'); if (ph) ph.remove();
    } catch { box.insertAdjacentHTML('beforeend', '<span class="vinfo">No disponible</span>'); }
}

// ─────────────────────────── visor ───────────────────────────
let viewerMsg = null;
async function openViewer(m) {
    viewerMsg = m;
    $('viewer').classList.add('on');
    const body = $('viewerBody');
    const box = m.el.querySelector('.b-media');
    const isVideo = m.data.type === 'video';
    if (!mediaCache.has(m.data.mediaId)) {
        body.innerHTML = '<span class="spinner"></span>';
        if (box) box.classList.add('loading');
    }
    try {
        const url = await fetchMedia(m, (p) => { const bar = box && box.querySelector('.prog i'); if (bar) bar.style.width = (p * 100) + '%'; });
        if (viewerMsg !== m) return;
        body.innerHTML = isVideo ? `<video src="${url}" controls autoplay playsinline></video>` : `<img src="${url}" alt="">`;
    } catch { body.innerHTML = '<span style="color:#fff">No se pudo cargar</span>'; }
    finally { if (box) box.classList.remove('loading'); }
}
window.closeViewer = () => { const v = $('viewerBody').querySelector('video'); if (v) v.pause(); $('viewer').classList.remove('on'); $('viewerBody').innerHTML = ''; viewerMsg = null; };
window.saveViewer = () => { if (viewerMsg) saveMedia(viewerMsg); };
async function saveMedia(m) {
    try {
        const url = await fetchMedia(m);
        const ext = m.data.type === 'video' ? ((m.payload.mime || '').includes('quicktime') ? 'mov' : 'mp4') : 'jpg';
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], `archivo_${Date.now()}.${ext}`, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
        const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { if (e && e.name !== 'AbortError') toast('No se pudo guardar'); }
}

// ─────────────────────────── acciones de mensaje ───────────────────────────
let actKey = null;
function attachPress(bubble, key) {
    let t = null, sx = 0, sy = 0, moved = false;
    bubble.addEventListener('touchstart', (e) => {
        moved = false; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        bubble.classList.add('pressed');
        t = setTimeout(() => { t = null; bubble.classList.remove('pressed'); if (navigator.vibrate) navigator.vibrate(10); openMsgActions(key, bubble); }, 430);
    }, { passive: true });
    bubble.addEventListener('touchmove', (e) => {
        if (Math.abs(e.touches[0].clientX - sx) > 8 || Math.abs(e.touches[0].clientY - sy) > 8) { moved = true; clearTimeout(t); t = null; bubble.classList.remove('pressed'); }
    }, { passive: true });
    bubble.addEventListener('touchend', () => { bubble.classList.remove('pressed'); if (t) { clearTimeout(t); t = null; } });
    bubble.addEventListener('contextmenu', (e) => { e.preventDefault(); openMsgActions(key, bubble); });
    bubble.addEventListener('click', (e) => {
        const m = msgs.get(key); if (!m || !m.payload) return;
        const rp = e.target.closest('.b-reply');
        if (rp) { gotoMsg(rp.dataset.goto); return; }
        if (e.target.closest('.b-media')) openViewer(m);
    });
}
function openMsgActions(key, bubble) {
    const m = msgs.get(key); if (!m || !m.payload) return;
    actKey = key;
    const mine = m.data.from === ME.id; const media = m.data.type !== 'text';
    $('actDeleteBtn').style.display = mine ? '' : 'none';
    $('actCopyBtn').style.display = m.payload.text ? '' : 'none';
    $('actSaveBtn').style.display = media ? '' : 'none';
    const box = $('msgActions'); box.classList.add('on'); $('msgActionsBg').classList.add('on');
    const r = bubble.getBoundingClientRect(); const bw = box.offsetWidth, bh = box.offsetHeight;
    let top = r.bottom + 6; if (top + bh > window.innerHeight - 10) top = Math.max(10, r.top - bh - 6);
    let left = mine ? r.right - bw : r.left; left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
    box.style.top = top + 'px'; box.style.left = left + 'px';
}
window.closeMsgActions = () => { $('msgActions').classList.remove('on'); $('msgActionsBg').classList.remove('on'); };
function snipOf(m) {
    if (m.data.type === 'image') return '📷 Foto' + (m.payload.text ? ' · ' + m.payload.text : '');
    if (m.data.type === 'video') return '🎥 Video' + (m.payload.text ? ' · ' + m.payload.text : '');
    return (m.payload.text || '').slice(0, 120);
}
window.actReply = () => {
    const m = msgs.get(actKey); closeMsgActions(); if (!m) return;
    replyTo = { id: m.key, who: m.data.from, snip: snipOf(m) };
    $('replyWho').textContent = nameOf(m.data.from); $('replyTxt').textContent = replyTo.snip;
    $('replyBar').classList.add('on'); input.focus();
};
window.cancelReply = () => { replyTo = null; $('replyBar').classList.remove('on'); };
window.actCopy = async () => {
    const m = msgs.get(actKey); closeMsgActions(); if (!m) return;
    try { await navigator.clipboard.writeText(m.payload.text || ''); toast('Copiado', 1200); } catch { toast('No se pudo copiar'); }
};
window.actSave = () => { const m = msgs.get(actKey); closeMsgActions(); if (m) saveMedia(m); };
window.actDelete = async () => {
    const m = msgs.get(actKey); closeMsgActions(); if (!m || m.data.from !== ME.id) return;
    try {
        await FB.remove(R(`messages/${m.key}`));
        if (m.data.mediaId) FB.remove(R(`media/${m.data.mediaId}`)).catch(() => {});
    } catch { toast('No se pudo eliminar'); }
};
function gotoMsg(key) {
    const m = msgs.get(key);
    if (!m) { toast('Mensaje no disponible'); return; }
    m.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const b = m.el.querySelector('.bubble'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
}

// ─────────────────────────── estado, lectura, scroll ───────────────────────────
function renderStatus() {
    const s = $('peerStatus'); const av = $('peerAvatar');
    const online = peerPresence && peerPresence.online && (Date.now() - (peerPresence.ts || 0) < 30000);
    av.classList.toggle('online', !!online);
    s.classList.remove('hot');
    if (peerTyping && online) { s.textContent = 'escribiendo…'; s.classList.add('hot'); return; }
    if (online) { s.textContent = 'en línea'; s.classList.add('hot'); return; }
    if (peerPresence && peerPresence.ts) s.textContent = 'últ. vez ' + lastSeen(peerPresence.ts);
    else s.textContent = 'desconectado';
}
setInterval(() => { if (inChat) renderStatus(); }, 15000);
function markRead() {
    if (!inChat || document.hidden || !nearBottom() || !FB || !ME) return;
    let last = 0;
    for (let i = order.length - 1; i >= 0; i--) { const m = msgs.get(order[i]); if (m.data.from !== ME.id) { last = m.data.ts || 0; break; } }
    if (last) FB.set(R(`read/${ME.id}`), last).catch(() => {});
    unreadWhileAway = 0; updateToBottom();
}
function updateToBottom() {
    const show = !nearBottom();
    $('toBottom').classList.toggle('on', show);
    const u = $('unreadBadge'); u.textContent = unreadWhileAway; u.classList.toggle('on', unreadWhileAway > 0 && show);
}
window.scrollToBottom = (smooth) => { scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); };
scroller.addEventListener('scroll', () => { updateToBottom(); if (nearBottom()) markRead(); }, { passive: true });

// ─────────────────────────── emojis ───────────────────────────
const EMOJIS = {
    '😀': '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 💩 🤡 👻 👽 🤖',
    '👍': '👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🫶 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🦾 🧠 👀 👁️ 👂 👃 🫦 🙋 🙆 🙅 🤷 🤦 🙇 💁 🧏 🏃 🚶 🧍 🧎 👨‍💻 👩‍💻 👷 🕵️ 🧑‍🍳 🧑‍🔧',
    '🐶': '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🐺 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦖 🐙 🦑 🦀 🐠 🐬 🐳 🦈 🐊 🐘 🦒 🐕 🐈 🌵 🌲 🌴 🌱 🍀 🍁 🍂 🌷 🌹 🌻 🌼 🌸 🌞 🌝 🌙 ⭐ 🌟 ✨ ⚡ 🔥 🌈 ☀️ ⛅ ☁️ 🌧️ ⛈️ ❄️ ☃️ 💧 🌊',
    '🍔': '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🌽 🥕 🥔 🍞 🥐 🧀 🥚 🍳 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍣 🍱 🥟 🍤 🍚 🍦 🍰 🎂 🧁 🍫 🍬 🍭 🍩 🍪 ☕ 🍵 🧃 🥤 🧋 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🧊',
    '⚽': '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🥋 ⛳ 🎣 🏋️ 🚴 🏊 🏄 🧘 🏆 🥇 🥈 🥉 🏅 🎖️ 🎗️ 🎫 🎟️ 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 ♟️ 🎯 🎳 🎮 🕹️ 🧩',
    '🚗': '🚗 🚕 🚙 🚌 🏎️ 🚓 🚑 🚒 🚚 🚜 🏍️ 🛵 🚲 🛴 🚨 🚦 🚧 ⚓ ⛵ 🚤 🛳️ ✈️ 🛫 🛬 🚁 🚀 🛸 🗺️ 🏔️ 🏕️ 🏖️ 🏝️ 🏟️ 🏛️ 🏠 🏢 🏥 🏦 🏨 🏪 🏫 ⛪ 🕌 🗽 🗼 🌆 🌃 🌉 🎢 🎡',
    '💡': '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💾 💿 📷 📸 📹 🎥 📞 ☎️ 📺 📻 🎙️ ⏰ ⏳ 🔋 🔌 💡 🔦 🕯️ 💸 💵 💰 💳 🧾 💎 ⚖️ 🔧 🔨 🛠️ ⚙️ 🧲 🧪 💊 🩹 🔑 🗝️ 🚪 🛋️ 🛏️ 🧸 🎁 🎈 🎉 🎊 ✉️ 📦 📅 📌 📎 ✂️ 📝 ✏️ 🔍 🔒 🔓',
    '✅': '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💯 ✅ ☑️ ✔️ ❌ ❎ ⭕ 🚫 ⛔ ❗ ❓ ‼️ ⁉️ ⚠️ 🔞 ♻️ 🆗 🆕 🆒 🆓 🔝 🔜 ▶️ ⏸️ ⏹️ ⏺️ ⏭️ 🔁 🔀 ➕ ➖ ✖️ ➗ 💲 ™️ ©️ ®️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🏁 🚩 🇨🇴'
};
let emojiCat = Object.keys(EMOJIS)[0];
function renderEmoji() {
    $('emojiTabs').innerHTML = Object.keys(EMOJIS).map(k => `<button class="${k === emojiCat ? 'on' : ''}" onclick="setEmojiCat('${k}')">${k}</button>`).join('');
    $('emojiGrid').innerHTML = EMOJIS[emojiCat].split(' ').map(e => `<button>${e}</button>`).join('');
    $('emojiGrid').scrollTop = 0;
}
window.setEmojiCat = (k) => { emojiCat = k; renderEmoji(); };
$('emojiGrid').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const s = input.selectionStart ?? input.value.length, en = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, s) + b.textContent + input.value.slice(en);
    const pos = s + b.textContent.length; try { input.setSelectionRange(pos, pos); } catch {}
    autoGrow();
});
window.toggleEmoji = () => {
    const on = !$('emojiPanel').classList.contains('on');
    closeAttach();
    if (on) { input.blur(); renderEmoji(); }
    $('emojiPanel').classList.toggle('on', on); $('emojiBtn').classList.toggle('on', on);
    if (on) setTimeout(() => scrollToBottom(false), 50);
};
function closeEmoji() { $('emojiPanel').classList.remove('on'); $('emojiBtn').classList.remove('on'); }

// ─────────────────────────── menú ───────────────────────────
window.toggleChatMenu = (e) => { e.stopPropagation(); $('chatMenu').classList.toggle('on'); };
function closeChatMenu() { $('chatMenu').classList.remove('on'); }
document.addEventListener('click', (e) => { if (!e.target.closest('#chatMenu')) closeChatMenu(); });

// ─────────────────────────── formato ───────────────────────────
function nameOf(id) { return id === ME?.id ? 'Tú' : (Object.values(USERS).find(u => u.id === id)?.name || '—'); }
function fmtTime(ts) { return new Date(ts || Date.now()).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }); }
function dayLabel(d) {
    const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Hoy';
    if (d.toDateString() === y.toDateString()) return 'Ayer';
    const opts = { weekday: 'long', day: 'numeric', month: 'long' };
    if (d.getFullYear() !== t.getFullYear()) opts.year = 'numeric';
    const s = d.toLocaleDateString('es-CO', opts); return s.charAt(0).toUpperCase() + s.slice(1);
}
function lastSeen(ts) {
    const d = new Date(ts); const diff = Date.now() - ts;
    if (diff < 60000) return 'hace un momento';
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`;
    const lbl = dayLabel(d);
    return (lbl === 'Hoy' ? 'hoy' : lbl === 'Ayer' ? 'ayer' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })) + ' a las ' + fmtTime(ts);
}
function fmtDur(s) { if (!s || !isFinite(s)) return '🎥'; s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function fmtSize(b) { if (!b) return ''; return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB'; }
function linkify(t) { return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#8fd0ff">$1</a>'); }
function isEmojiOnly(t) {
    const s = t.replace(/\s/g, ''); if (!s || s.length > 24) return false;
    try { return /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️)+$/u.test(s) && !/^[\d#*]+$/.test(s); } catch { return false; }
}

// ─────────────────────────── teclado / viewport (iOS) ───────────────────────────
function fitViewport() {
    const vv = window.visualViewport; const chat = $('chat');
    if (!vv) return;
    chat.style.height = vv.height + 'px';
    chat.style.transform = `translateY(${vv.offsetTop}px)`;
    const kb = window.innerHeight - vv.height > 120;
    chat.style.setProperty('--foot-safe', kb ? '0px' : 'env(safe-area-inset-bottom,0px)');
}
if (window.visualViewport) {
    visualViewport.addEventListener('resize', () => { const b = nearBottom(); fitViewport(); if (b) scrollToBottom(false); });
    visualViewport.addEventListener('scroll', fitViewport);
}
if (window.ResizeObserver) new ResizeObserver(() => $('chat').style.setProperty('--foot-h', $('chatFoot').offsetHeight + 'px')).observe($('chatFoot'));

// ─────────────────────────── bloqueo automático ───────────────────────────
// Si la app queda en segundo plano más de 60 s, el chat se cierra y vuelve a la
// tienda (hay que poner el código otra vez). No aplica mientras se elige una foto.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        hiddenAt = pickingFile ? 0 : Date.now();
        if (inChat) { setPresence(false); stopTyping(); }
    } else {
        if (inChat && hiddenAt && Date.now() - hiddenAt > 60000) { window.lockChat(); }
        else if (inChat) { setPresence(true); clearNotifications(); markRead(); }
        hiddenAt = 0;
    }
});

// ═══════════════════════════ AVISOS PUSH ═══════════════════════════
const pushSupported = () => ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window) && location.protocol === 'https:' && !window.Capacitor;
let swReg = null;
async function registerSW() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http') || window.Capacitor) return;
    try { swReg = await navigator.serviceWorker.register('sw.js'); } catch {}
}
function clearNotifications() {
    try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_NOTIFICATIONS' }); } catch {}
}
function urlB64ToUint8(b) { const p = '='.repeat((4 - b.length % 4) % 4); const s = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); }
async function subscribePush() {
    const reg = swReg || await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) });
    await FB.set(R(`push/${ME.id}`), JSON.stringify(sub));
    return sub;
}
window.enablePush = async (fromUser) => {
    closeChatMenu();
    if (!pushSupported()) {
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        toast(ios ? 'En iPhone: abre la tienda en Safari → Compartir → “Agregar a inicio”, y actívalos desde ahí.' : 'Este dispositivo no admite avisos en esta versión.', 4500);
        return;
    }
    try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { toast('Permiso de avisos denegado. Actívalo en los ajustes del teléfono.', 3500); return; }
        await subscribePush();
        if (fromUser) toast('🔔 Avisos activados');
        updatePushMenu();
    } catch (e) { console.error(e); toast('No se pudieron activar los avisos'); }
};
async function autoRefreshPush() {
    if (pushSupported() && Notification.permission === 'granted') { try { await subscribePush(); } catch {} }
    updatePushMenu();
}
function updatePushMenu() {
    const on = pushSupported() && Notification.permission === 'granted';
    $('pushMenuBtn').textContent = on ? '🔔 Avisos activados ✓' : '🔔 Activar avisos';
}
function updatePushLabel() {
    $('accPushState').textContent = !pushSupported() ? 'No disponible en este dispositivo' : (Notification.permission === 'granted' ? 'Activadas' : 'Desactivadas');
}

// ═══════════════════════════ ARRANQUE ═══════════════════════════
renderCats(); renderGrid(); renderFlash(); tickFlash(); updateBadge();
setInterval(tickFlash, 1000);
registerSW();
