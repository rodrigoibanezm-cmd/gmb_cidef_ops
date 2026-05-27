function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function add(parent, child) {
  parent.appendChild(child);
  return child;
}

function dateText(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || 'Sin fecha';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function shortDateText(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value || '';
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function alertDate(alert) {
  return alert.alert_date || alert.classified_at || alert.review_date || alert.published_at || alert.publish_time || alert.publishTime || alert.created_at || alert.captured_at || alert.date || alert.captured_date;
}

function factsMap(facts = []) {
  const out = {};
  for (const raw of facts) {
    const [key, ...rest] = String(raw).split('=');
    if (key && rest.length) out[key] = rest.join('=');
  }
  return out;
}

function accordionCard(title, opts = {}) {
  const card = el('details', `card accordion-card ${opts.tint || ''}`);
  if (opts.open) card.open = true;

  const summaryNode = add(card, el('summary', 'accordion-summary'));
  const titleNode = add(summaryNode, el('span', 'micro', title));
  if (opts.meta) titleNode.append(` · ${opts.meta}`);

  const body = add(card, el('div', 'card-body'));
  return { card, body };
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
  btn.href = agentUrl(data);
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

function makePrompt(action, data) {
  const names = (action.items || [])
    .slice(0, Number(action.value) || 5)
    .map(x => x.name || x.own_name)
    .filter(Boolean)
    .join(', ');
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

function actionCards(data) {
  const { card, body } = accordionCard('Acción inmediata');
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
  const meta = `${int(data.competitive_summary?.risk_count)} zonas`;
  const { card, body } = accordionCard('Riesgo competitivo local', { tint: 'tint-red', meta });
  add(body, el('p', 'summary-text', data.competitive_summary?.headline || 'Hay zonas donde la red propia pierde liderazgo local.'));
  const list = add(body, el('ul', 'store-list'));
  data.local_competitive_risk.slice(0, 5).forEach((item, idx) => addStoreRow(list, item, idx));
  return card;
}

function redFlags(items = []) {
  const { card, body } = accordionCard('Tiendas bajo umbral', { tint: 'tint-red', meta: `Top ${Math.min(items.length, 3)}` });
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
  const { card, body } = accordionCard('Resumen ejecutivo');
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
  const { card, body } = accordionCard(title, { tint, meta: `Top ${Math.min(items.length, limit)}` });
  const list = add(body, el('ul', 'store-list'));
  items.slice(0, limit).forEach((item, idx) => addStoreRow(list, item, idx));
  return card;
}

function severityLabel(value) {
  if (value === 'critical') return 'Crítica';
  if (value === 'high') return 'Alta';
  if (value === 'medium') return 'Media';
  return 'Baja';
}

function qualitativeAlerts(data) {
  const q = data.qualitative_alerts || {};
  const alerts = q.top_alerts || [];
  if (!hasItems(alerts)) return null;

  const meta = `${int(q.critical_count || 0)} críticas · ${int(q.high_count || 0)} altas`;
  const { card, body } = accordionCard('Alertas cualitativas', { tint: 'tint-red', meta, open: true });

  const list = add(body, el('ul', 'qual-list'));
  alerts.forEach(alert => {
    const row = add(list, el('li', 'qual-row'));
    const head = add(row, el('div', 'qual-head'));
    add(head, el('span', `severity ${alert.severity === 'critical' ? 'high' : 'medium'}`, severityLabel(alert.severity)));
    add(head, el('strong', '', alert.safe_label || 'Alerta cualitativa'));
    const date = shortDateText(alertDate(alert));
    if (date) add(head, el('span', 'alert-date', date));
    add(row, el('div', 'store-name', alert.store_name || 'Tienda sin nombre'));
    add(row, el('div', 'location', alert.location || ''));
    add(row, el('p', 'reason', alert.summary || ''));
    if (alert.evidence_excerpt) add(row, el('blockquote', 'evidence-quote', alert.evidence_excerpt));
  });
  return card;
}

window.DashboardComponents = {
  add,
  el,
  makeHeader,
  kpi,
  actionCards,
  competitiveRisk,
  redFlags,
  summary,
  listCard,
  qualitativeAlerts
};
