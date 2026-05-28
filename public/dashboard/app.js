const app = document.getElementById('app');

const SECTION_LABELS = {
  urgente: 'Urgente hoy',
  tareas: 'Tareas de la semana',
  importante: 'Importante esta semana'
};

const ICONS = {
  legal: '⚖️',
  incident: '⚠️',
  competitive: '📉',
  pattern: '🔁',
  operations: '🛠️',
  opportunity: '💡',
  monitoring: '·'
};

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

function clear() {
  app.replaceChildren();
}

function state(message) {
  clear();
  add(app, el('div', 'state state-page', message));
}

function titleCaseTenant(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function agentUrl(data, card) {
  const base = window.DashboardConfig.AGENT_URLS[data.tenant_id] || '#';
  if (!card || base === '#') return base;

  const prompt = [
    `Analiza esta prioridad operacional del tenant ${data.tenant_id}:`,
    card.headline,
    `Por qué importa: ${card.why_it_matters}`,
    `Acción sugerida: ${card.suggested_action}`
  ].join('\n');

  return `${base}?q=${encodeURIComponent(prompt)}`;
}

function renderHeader(data) {
  const header = el('header', 'ops-header');
  const inner = add(header, el('div', 'ops-header-inner'));
  const left = add(inner, el('div'));
  add(left, el('div', 'product', 'NexusG · Triage operacional ejecutivo'));
  add(left, el('h1', 'tenant', titleCaseTenant(data.tenant_id)));
  add(left, el('div', 'ops-subtitle', 'Decisiones comprimidas para actuar sin revisar un dashboard.'));

  const btn = add(inner, el('a', 'agent-btn', 'Abrir agente →'));
  btn.href = agentUrl(data);
  return header;
}

function renderEvidence(list, items = []) {
  if (!items.length) return;
  items.forEach(item => add(list, el('li', '', item)));
}

function renderChildren(parent, children = []) {
  if (!children.length) return;
  const wrap = add(parent, el('div', 'ops-children'));
  add(wrap, el('div', 'ops-detail-label', 'Señales agrupadas'));
  children.slice(0, 3).forEach(child => {
    const row = add(wrap, el('div', 'ops-child'));
    add(row, el('strong', '', child.headline || child.title || child.label || 'Señal relacionada'));
    if (child.summary || child.evidence) add(row, el('span', '', child.summary || child.evidence));
  });
}

function renderCard(card, data) {
  const details = el('details', `ops-card color-${card.color_key || 'gray'}`);
  details.dataset.cardId = card.id;

  const summary = add(details, el('summary', 'ops-card-summary'));
  add(summary, el('span', 'ops-icon', ICONS[card.icon_key] || ICONS[card.type] || '•'));
  add(summary, el('span', 'ops-headline', card.headline));
  add(summary, el('span', 'ops-chevron', '›'));

  const body = add(details, el('div', 'ops-card-body'));

  const why = add(body, el('section', 'ops-detail-block'));
  add(why, el('div', 'ops-detail-label', 'Por qué importa'));
  add(why, el('p', '', card.why_it_matters));

  const action = add(body, el('section', 'ops-detail-block'));
  add(action, el('div', 'ops-detail-label', 'Qué hacer'));
  add(action, el('p', '', card.suggested_action));

  const evidence = add(body, el('section', 'ops-detail-block'));
  add(evidence, el('div', 'ops-detail-label', 'Evidencia'));
  const evidenceList = add(evidence, el('ul', 'ops-evidence'));
  renderEvidence(evidenceList, card.evidence || []);

  renderChildren(body, card.children || []);

  const footer = add(body, el('div', 'ops-card-footer'));
  const ask = add(footer, el('a', 'ops-card-agent', 'Preguntar sobre esto →'));
  ask.href = agentUrl(data, card);

  details.addEventListener('toggle', () => {
    if (!details.open) return;
    document.querySelectorAll('.ops-card[open]').forEach(openCard => {
      if (openCard !== details) openCard.open = false;
    });
  });

  return details;
}

function renderSection(section, data) {
  const wrap = el('section', 'ops-section');
  const header = add(wrap, el('div', 'ops-section-header'));
  add(header, el('h2', '', SECTION_LABELS[section.id] || section.id));
  add(header, el('span', '', `${section.cards.length}`));

  const grid = add(wrap, el('div', 'ops-card-grid'));
  section.cards.forEach(card => add(grid, renderCard(card, data)));

  if (!section.cards.length) {
    add(grid, el('div', 'ops-empty', 'Sin señales que superen umbral de acción.'));
  }

  return wrap;
}

function render(data) {
  clear();
  add(app, renderHeader(data));

  const main = add(app, el('main', 'container ops-main'));
  const summary = add(main, el('section', 'ops-brief'));
  add(summary, el('div', 'ops-brief-title', 'Qué requiere atención'));
  add(summary, el('p', '', `${data.card_count || 0} prioridades activas. Máximo visible: ${data.max_cards || 12}.`));

  (data.sections || []).forEach(section => add(main, renderSection(section, data)));

  const mobileAgent = add(app, el('a', 'mobile-agent', 'Abrir agente ↗'));
  mobileAgent.href = agentUrl(data);
}

async function init() {
  const tenant_id = new URLSearchParams(window.location.search).get('tenant_id');
  if (!tenant_id) return state('Falta tenant_id en la URL.');

  try {
    const res = await fetch(`${window.DashboardConfig.API_BASE}?tenant_id=${encodeURIComponent(tenant_id)}&view=operational`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      return state(data?.error === 'invalid_tenant_id' ? 'Tenant no válido.' : 'No se pudo cargar el dashboard operacional.');
    }

    render(data);
  } catch (e) {
    state('No se pudo cargar el dashboard operacional.');
  }
}

init();
