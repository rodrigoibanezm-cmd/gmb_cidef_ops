const API_BASE = '/api/dashboard';
const AGENT_URL = '#';
const app = document.getElementById('app');

const fmt = (v, d = 2) => Number.isFinite(Number(v)) ? Number(v).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const int = v => Number.isFinite(Number(v)) ? Number(v).toLocaleString('es-CL') : '—';
const signedInt = v => Number.isFinite(Number(v)) ? `${Number(v) > 0 ? '+' : ''}${Number(v).toLocaleString('es-CL', { maximumFractionDigits: 0 })}` : '—';
const delta = v => Number.isFinite(Number(v)) ? `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}` : '—';
const tone = v => Number(v) > 0 ? 'good' : Number(v) < 0 ? 'risk' : 'neutral';
const trend = v => Number(v) > 0 ? 'Mejora' : Number(v) < 0 ? 'Deterioro' : 'Estable';
const arrow = v => Number(v) > 0 ? '↗' : Number(v) < 0 ? '↘' : '→';
const hasItems = items => Array.isArray(items) && items.length > 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function add(parent, child) { parent.appendChild(child); return child; }
function clear() { app.replaceChildren(); }
function state(message) { clear(); add(app, el('div', 'state state-page', message)); }

function dateText(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || 'Sin fecha';
  return d.toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function factsMap(facts = []) {
  const out = {};
  for (const raw of facts) {
    const [key, ...rest] = String(raw).split('=');
    if (key && rest.length) out[key] = rest.join('=');
  }
  return out;
}

function makeHeader(data) {
  const header = el('header', 'header');
  const inner = add(header, el('div', 'header-inner'));
  const left = add(inner, el('div'));
  add(left, el('div', 'product', 'NexusG · Reputation Command Center'));
  add(left, el('h1', 'tenant', data.tenant_name));
  const meta = add(left, el('div', 'header-meta'));
  const pill = add(meta, el('span', 'status-pill'));
  add(pill, el('span', 'status-dot'));
  pill.append(' Datos operacionales actualizados');
  add(meta, el('span', 'updated', dateText(data.updated_at)));
  const btn = add(inner, el('a', 'agent-btn', 'Abrir agente →'));
  btn.href = AGENT_URL;
  return header;
}

function kpi(title, value, sub, tint, valueClass = '') {
  const card = el('section', `card kpi-card ${tint || ''}`);
  add(card, el('div', 'micro', title));
  add(card, el('div', `kpi-value ${valueClass}`, value));
  if (sub) add(card, el('div', 'kpi-sub', sub));
  return card;
}

function actionItems(data) {
  const k = data.kpis || {};
  const p = data.mobile_priority || {};
  const c = data.competitive_summary || {};
  return [
    { label: 'Pierden su zona', value: c.risk_count ?? 0, cls: '', items: data.local_competitive_risk || [] },
    { label: 'Tiendas bajo umbral', value: p.critical_count ?? k.critical_stores, cls: 'warn-tile', items: data.red_flags || [] },
    { label: 'Requieren intervención', value: p.immediate_action_count ?? 0, cls: '', items: (data.local_competitive_risk || []).slice(0, p.immediate_action_count || 2) }
  ];
}

function actionCards(data) {
  const card = el('section', 'card action-card');
  const head = add(card, el('div', 'card-head'));
  add(head, el('div', 'micro', 'Acción inmediata'));
  const body = add(card, el('div', 'card-body'));
  const tiles = add(body, el('div', 'action-grid'));
  const detail = add(body, el('div', 'action-detail'));

  actionItems(data).forEach((action, index) => {
    const tile = add(tiles, el('button', `action-tile ${action.cls}`));
    tile.type = 'button';
    add(tile, el('strong', '', int(action.value)));
    add(tile, el('span', '', action.label));

    tile.addEventListener('click', () => {
      [...tiles.children].forEach(x => x.classList.remove('active'));
      tile.classList.add('active');
      renderActionDetail(detail, action, data);
    });

    if (index === 0) {
      tile.classList.add('active');
      renderActionDetail(detail, action, data);
    }
  });

  return card;
}

function makePrompt(action, data) {
  const names = (action.items || []).slice(0, Number(action.value) || 5).map(x => x.name || x.own_name).filter(Boolean).join(', ');
  return `Analiza ${action.label.toLowerCase()} del tenant ${data.tenant_id}. Prioriza ${names}. Entrega diagnóstico, evidencia, riesgo y acción recomendada.`;
}

async function copyPrompt(button, action, data) {
  const text = makePrompt(action, data);
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Prompt copiado';
    setTimeout(() => { button.textContent = 'Copiar prompt agente'; }, 1400);
  } catch (e) {
    button.textContent = 'No se pudo copiar';
    setTimeout(() => { button.textContent = 'Copiar prompt agente'; }, 1400);
  }
}

function renderActionDetail(target, action, data) {
  target.replaceChildren();
  const head = add(target, el('div', 'action-detail-head'));
  add(head, el('div', 'micro', action.label));
  const copy = add(head, el('button', 'copy-btn', 'Copiar prompt agente'));
  copy.type = 'button';
  copy.addEventListener('click', () => copyPrompt(copy, action, data));
  const list = add(target, el('ul', 'store-list'));
  (action.items || []).slice(0, Number(action.value) || 5).forEach((item, idx) => addStoreRow(list, item, idx));
}

function addStoreRow(list, item, idx) {
  const row = add(list, el('li', 'store-row'));
  add(row, el('div', 'rank', item.rank || item.local_rank || idx + 1));
  const main = add(row, el('div', 'store-main'));
  add(main, el('div', 'store-name', item.name || item.own_name));
  add(main, el('div', 'location', item.location || item.reason || ''));
  if (item.reason) add(main, el('div', 'reason', item.reason));
  if (item.leader_name) add(main, el('div', 'reason', `Líder local: ${item.leader_name} · ${fmt(item.leader_rating, 1)}`));
  const metrics = add(row, el('div', 'store-metrics'));
  add(metrics, el('div', 'rating', fmt(item.rating ?? item.own_rating)));
  if (Number(item.gap_vs_leader)) add(metrics, el('div', 'delta risk', delta(item.gap_vs_leader)));
  else if (Number(item.delta)) add(metrics, el('div', `delta ${tone(item.delta)}`, delta(item.delta)));
  if (item.review_count || item.own_review_count) add(metrics, el('div', 'reviews', `${int(item.review_count || item.own_review_count)} reviews`));
}

function competitiveRisk(data) {
  if (!hasItems(data.local_competitive_risk)) return null;
  const card = el('section', 'card competitive-card tint-red');
  const head = add(card, el('div', 'card-head'));
  add(head, el('div', 'micro', 'Riesgo competitivo local'));
  const body = add(card, el('div', 'card-body'));
  add(body, el('p', 'summary-text', data.competitive_summary?.headline || 'Hay zonas donde la red propia pierde liderazgo local.'));
  const list = add(body, el('ul', 'store-list'));
  data.local_competitive_risk.slice(0, 5).forEach((item, idx) => addStoreRow(list, item, idx));
  return card;
}

function redFlags(items = []) {
  const card = el('section', 'card tint-red');
  const head = add(card, el('div', 'card-head'));
  add(head, el('div', 'micro', 'Tiendas bajo umbral'));
  add(head, el('div', 'micro', `Top ${Math.min(items.length, 3)}`));
  const body = add(card, el('div', 'card-body'));
  const list = add(body, el('ul', 'red-list'));
  items.slice(0, 3).forEach(item => {
    const row = add(list, el('li', 'red-row'));
    add(row, el('span', 'red-dot'));
    const info = add(row, el('div'));
    const title = add(info, el('div', 'red-title'));
    add(title, el('span', 'store-name', item.name));
    add(title, el('span', 'location', `· ${item.location || ''}`));
    const sev = String(item.severity || '').toLowerCase() === 'high' ? 'Alto' : 'Medio';
    add(title, el('span', `severity ${sev === 'Alto' ? 'high' : 'medium'}`, sev));
    add(info, el('div', 'reason', item.reason));
    const metrics = add(row, el('div', 'red-metrics'));
    add(metrics, el('div', 'rating', fmt(item.rating)));
    if (Number(item.delta)) add(metrics, el('div', `delta ${tone(item.delta)}`, delta(item.delta)));
    add(metrics, el('div', 'reviews', `${int(item.review_count)} reviews`));
  });
  return card;
}

function summary(data, mobile = false) {
  const facts = factsMap(data.executive_summary?.facts);
  const card = el('section', 'card');
  const head = add(card, el('div', 'card-head'));
  add(head, el('div', 'micro', 'Resumen ejecutivo'));
  const body = add(card, el('div', 'card-body'));
  add(body, el('p', 'summary-text', mobile ? data.executive_summary?.mobile_hint : data.executive_summary?.desktop_hint));
  const list = add(body, el('ul', 'facts-list'));
  const rows = [
    ['Nota actual', fmt(facts.rating ?? data.kpis.average_rating)],
    ['Tendencia', delta(facts.rating_delta ?? data.kpis.rating_delta)],
    ['Bajo umbral', int(facts.critical_stores ?? data.kpis.critical_stores)],
    ['Zonas que pierden', int(data.competitive_summary?.risk_count)]
  ];
  rows.forEach(([label, value]) => {
    const row = add(list, el('li', 'fact-row'));
    add(row, el('span', 'fact-label', label));
    add(row, el('span', 'fact-value', value));
  });
  return card;
}

function listCard(title, items = [], limit = 5, tint = '') {
  const card = el('section', `card ${tint}`);
  const head = add(card, el('div', 'card-head'));
  add(head, el('div', 'micro', title));
  const body = add(card, el('div', 'card-body'));
  const list = add(body, el('ul', 'store-list'));
  items.slice(0, limit).forEach((item, idx) => addStoreRow(list, item, idx));
  return card;
}

function desktop(data) {
  const wrap = el('div', 'desktop-only');
  const main = add(wrap, el('div', 'container main'));
  const k = data.kpis;
  const kpis = add(main, el('div', 'grid kpi-grid'));
  add(kpis, kpi('Nota promedio', fmt(k.average_rating), `${delta(k.rating_delta)} vs. ayer`, 'tint-blue'));
  add(kpis, kpi('Tendencia', trend(k.rating_delta), `${delta(k.rating_delta)} pts`, Number(k.rating_delta) < 0 ? 'tint-red' : 'tint-green', tone(k.rating_delta)));
  add(kpis, kpi('Reviews', int(k.total_reviews), `${signedInt(k.reviews_delta)} vs. ayer`, 'tint-violet'));
  add(kpis, kpi('Pierden su zona', int(data.competitive_summary?.risk_count), 'Riesgo competitivo local', 'tint-red', 'risk'));
  add(kpis, kpi('Bajo umbral', int(k.critical_stores), 'Rating menor a 4.0', 'tint-red', 'risk'));
  add(kpis, kpi('Mejor tienda', k.best_store?.name || '—', `${fmt(k.best_store?.rating)} · ${k.best_store?.location || ''}`, 'tint-green', 'small'));
  const comp = competitiveRisk(data);
  if (comp) add(main, comp);
  add(main, actionCards(data));
  const ctx = add(main, el('div', 'grid context-grid'));
  add(ctx, redFlags(data.red_flags));
  add(ctx, summary(data));
  const ops = add(main, el('div', 'grid operational-grid'));
  if (hasItems(data.movements?.up)) add(ops, listCard('Mayores alzas', data.movements.up, 5, 'tint-green'));
  if (hasItems(data.movements?.down)) add(ops, listCard('Mayores bajas', data.movements.down, 5, 'tint-red'));
  add(ops, listCard('Top 5', data.rankings?.top));
  add(ops, listCard('Bottom 5', data.rankings?.bottom));
  const footer = add(main, el('footer', 'footer'));
  add(footer, el('span', '','Fuente: Google Places / Neon'));
  add(footer, el('span','', data.source || 'runtime'));
  return wrap;
}

function mobile(data) {
  const wrap = el('div', 'mobile-only');
  const main = add(wrap, el('div', 'container main mobile-stack'));
  const k = data.kpis;
  const p = data.mobile_priority || {};
  const hero = add(main, el('section', 'hero-card'));
  add(hero, el('div', 'micro', 'Nota promedio'));
  add(hero, el('div', 'hero-rating', fmt(k.average_rating)));
  const since = add(hero, el('div', 'hero-since'));
  add(since, el('span', '', `Reviews ${signedInt(k.reviews_delta)} vs. ayer`));
  add(since, el('span', '', `Rating ${delta(k.rating_delta)} pts`));
  const crit = add(hero, el('div', 'hero-critical'));
  add(crit, el('strong', '', int(data.competitive_summary?.risk_count)));
  crit.append(' zonas con riesgo');
  add(hero, el('div', 'hero-headline', data.competitive_summary?.headline || p.headline || data.executive_summary?.mobile_hint || ''));
  const comp = competitiveRisk(data);
  if (comp) add(main, comp);
  add(main, actionCards(data));
  add(main, el('div', 'micro risk', '⚠ Tiendas bajo umbral'));
  add(main, redFlags(data.red_flags));
  if (hasItems(data.movements?.down)) add(main, listCard('Mayores bajas', data.movements.down, 3));
  add(main, summary(data, true));
  if (hasItems(data.movements?.up)) add(main, listCard('Mayores alzas', data.movements.up, 3));
  add(main, listCard('Top 5', data.rankings?.top, 5));
  add(main, listCard('Bottom 5', data.rankings?.bottom, 5));
  const btn = add(wrap, el('a', 'mobile-agent', 'Abrir agente ↗'));
  btn.href = AGENT_URL;
  return wrap;
}

function render(data) {
  clear();
  add(app, makeHeader(data));
  add(app, desktop(data));
  add(app, mobile(data));
}

async function init() {
  const tenant_id = new URLSearchParams(window.location.search).get('tenant_id');
  if (!tenant_id) return state('Falta tenant_id en la URL.');
  try {
    const res = await fetch(`${API_BASE}?tenant_id=${encodeURIComponent(tenant_id)}&view=full`);
    const data = await res.json();
    if (!res.ok || !data.ok) return state(data?.error === 'invalid_tenant_id' ? 'Tenant no válido.' : 'No se pudo cargar el dashboard.');
    render(data);
  } catch (e) {
    state('No se pudo cargar el dashboard.');
  }
}

init();