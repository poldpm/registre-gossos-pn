// ============================================================
// CONFIGURACIÓ
// Substitueix la URL de sota per la del teu Apps Script Web App
// (la trobaràs després de fer "Implementar" a Apps Script).
// ============================================================
const CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwXfARxx3B58cUCCh9hUi4vXQg7Z6u38345r_zm0DJaM4NOWhw_xLb43gVnJEY67WF2_g/exec"
};

// ---------- Claus d'emmagatzematge local ----------
const K_NOM = 'gp_nom';
const K_DATA = 'gp_data';     // data (YYYY-MM-DD) de l'última selecció de zona
const K_QUEUE = 'gp_queue';   // registres pendents de sincronitzar
const K_LOG = 'gp_log';       // historial local (per comptadors)

// ---------- Utilitats d'emmagatzematge ----------
function getNom() { return localStorage.getItem(K_NOM) || ''; }
// En desar la zona hi guardem també la data d'avui, per saber si la
// selecció és d'avui o d'un dia anterior (avuiISO està definida a sota).
function setNom(v) { localStorage.setItem(K_NOM, v); localStorage.setItem(K_DATA, avuiISO()); }
function getDataSeleccio() { return localStorage.getItem(K_DATA) || ''; }

function getQueue() {
  try { return JSON.parse(localStorage.getItem(K_QUEUE)) || []; }
  catch (e) { return []; }
}
function saveQueue(q) { localStorage.setItem(K_QUEUE, JSON.stringify(q)); }

function getLog() {
  try { return JSON.parse(localStorage.getItem(K_LOG)) || []; }
  catch (e) { return []; }
}
function saveLog(l) {
  // mantenim com a màxim els últims 500 registres locals
  if (l.length > 500) l = l.slice(l.length - 500);
  localStorage.setItem(K_LOG, JSON.stringify(l));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function avuiISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ---------- Elements ----------
const screens = {
  nom: document.getElementById('screen-nom'),
  main: document.getElementById('screen-main'),
  deslligat: document.getElementById('screen-deslligat'),
  config: document.getElementById('screen-config'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Comptadors ----------
function updateCounters() {
  const log = getLog();
  const avui = avuiISO();
  const registresAvui = log.filter(r => r.timestamp.slice(0, 10) === avui);

  const lligats = registresAvui.filter(r => r.estat === 'Lligat').length;
  const deslligats = registresAvui.filter(r => r.estat === 'Deslligat').length;

  document.getElementById('countLligats').textContent = lligats;
  document.getElementById('countDeslligats').textContent = deslligats;

  const pendents = getQueue().length;
  const badge = document.getElementById('pendents');
  const badgeConfig = document.getElementById('configPendents');
  badge.textContent = pendents > 0 ? `⏳ ${pendents} pendents` : '✓ Tot sincronitzat';
  badge.classList.toggle('zero', pendents === 0);
  badgeConfig.textContent = pendents;
  comprovarPendentsAntics();
}

// ---------- Avís de registres encallats ----------
// Els registres pendents encara NO són al full: viuen només a la tablet.
// Si en queden d'un dia anterior, es podrien perdre si algú reinstal·la
// l'app o es fa malbé la tablet. Ho avisem de manera ben visible.
function comprovarPendentsAntics() {
  const barra = document.getElementById('avisPendents');
  const queue = getQueue();

  let mesAntic = null;
  queue.forEach(function (r) {
    const t = Date.parse(r && r.timestamp);
    if (!isNaN(t) && (mesAntic === null || t < mesAntic)) mesAntic = t;
  });

  let diaAntic = null;
  if (mesAntic !== null) {
    const d = new Date(mesAntic);
    diaAntic = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  const encallat = (diaAntic !== null && diaAntic < avuiISO());
  if (!encallat) {
    if (barra) barra.remove();
    return;
  }

  const dies = Math.max(1, Math.round((Date.now() - mesAntic) / 86400000));
  const text = '⚠️ Hi ha ' + queue.length + ' registre' + (queue.length === 1 ? '' : 's') +
    ' sense enviar des de fa ' + dies + (dies === 1 ? ' dia' : ' dies') +
    '. Ves on hi hagi cobertura i obre l\'app. NO esborris ni reinstal·lis l\'app.';

  if (barra) {
    const p = barra.querySelector('span');
    if (p) p.textContent = text;
    return;
  }

  const nova = document.createElement('div');
  nova.id = 'avisPendents';
  nova.setAttribute('role', 'alert');
  nova.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:1500;' +
    'background:#c62828;color:#fff;padding:12px 16px;' +
    'padding-bottom:max(12px,env(safe-area-inset-bottom));' +
    'font-size:0.95rem;line-height:1.35;text-align:center;' +
    'box-shadow:0 -3px 12px rgba(0,0,0,0.35);';
  const span = document.createElement('span');
  span.textContent = text;
  nova.appendChild(span);
  document.body.appendChild(nova);
}

function updateConnexioIndicator() {
  const el = document.getElementById('estatConnexio');
  if (navigator.onLine) {
    el.textContent = '● Connectat';
    el.classList.remove('offline');
  } else {
    el.textContent = '● Sense connexió';
    el.classList.add('offline');
  }
}

// ---------- Registre ----------
function addRecord(estat, resposta) {
  const record = {
    id: uid(),
    timestamp: new Date().toISOString(),
    nom: getNom(),
    estat: estat,
    resposta: resposta || ''
  };

  // afegim al log local (per comptadors) i a la cua de sincronització
  const log = getLog();
  log.push(record);
  saveLog(log);

  const queue = getQueue();
  queue.push(record);
  saveQueue(queue);

  updateCounters();

  const text = estat === 'Lligat'
    ? '🟢 Registrat: gos lligat'
    : `🔴 Registrat: gos deslligat (${resposta})`;
  toast(text);

  document.getElementById('ultimRegistre').textContent =
    'Últim registre: ' + (estat === 'Lligat' ? 'Gos lligat' : `Gos deslligat — ${resposta}`) +
    ' a les ' + new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });

  trySync();
}

// ---------- Sincronització ----------
let sincronitzant = false;

async function trySync() {
  if (sincronitzant) return;
  if (!navigator.onLine) { updateCounters(); return; }
  if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.startsWith('ENGANXA')) return;

  sincronitzant = true;
  let queue = getQueue();

  while (queue.length > 0) {
    const record = queue[0];
    try {
      const resp = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(record)
      });
      if (!resp.ok) throw new Error('resposta no OK');

      // èxit: eliminem de la cua
      queue.shift();
      saveQueue(queue);
      updateCounters();
    } catch (e) {
      // sense connexió real o error temporal: ho deixem per més tard
      break;
    }
  }
  sincronitzant = false;
}

// ---------- Esdeveniments ----------
document.getElementById('btnGuardarNom').addEventListener('click', () => {
  const v = document.getElementById('inputNom').value;
  if (!v) { toast('Selecciona la zona abans de continuar'); return; }
  setNom(v);
  document.getElementById('infoNom').textContent = '📍 ' + v;
  showScreen('main');
});

document.getElementById('btnLligat').addEventListener('click', () => {
  addRecord('Lligat');
});

document.getElementById('btnDeslligat').addEventListener('click', () => {
  showScreen('deslligat');
});

document.getElementById('btnCancelarDeslligat').addEventListener('click', () => {
  showScreen('main');
});

document.querySelectorAll('#screen-deslligat [data-resposta]').forEach(btn => {
  btn.addEventListener('click', () => {
    addRecord('Deslligat', btn.dataset.resposta);
    showScreen('main');
  });
});

document.getElementById('btnConfig').addEventListener('click', () => {
  // pre-selecciona la zona guardada al desplegable de configuració
  const select = document.getElementById('configNom');
  const zonaActual = getNom();
  Array.from(select.options).forEach(opt => {
    opt.selected = opt.value === zonaActual;
  });
  updateCounters();
  showScreen('config');
});

document.getElementById('btnTancarConfig').addEventListener('click', () => {
  const v = document.getElementById('configNom').value;
  if (v) {
    setNom(v);
    document.getElementById('infoNom').textContent = '📍 ' + v;
  }
  showScreen('main');
});

document.getElementById('btnSincronitzarAra').addEventListener('click', () => {
  trySync().then(() => toast('Sincronització intentada'));
});

window.addEventListener('online', () => { updateConnexioIndicator(); trySync(); });
window.addEventListener('offline', updateConnexioIndicator);

// ---------- Inicialització ----------
function init() {
  updateConnexioIndicator();

  // Cada jornada (dia nou) tornem a demanar la zona: només saltem a la
  // pantalla principal si la selecció és d'AVUI. Si és d'un dia anterior,
  // mostrem la selecció de zona perquè es triï el sector del dia.
  if (getNom() && getDataSeleccio() === avuiISO()) {
    document.getElementById('infoNom').textContent = '📍 ' + getNom();
    showScreen('main');
  } else {
    showScreen('nom');
  }

  updateCounters();
  trySync();

  // intent periòdic de sincronització (cada 30s)
  setInterval(trySync, 30000);

  // registrem el service worker per funcionament offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

init();
