const PressureBoard = (() => {
  const SECTION_LABELS = {
    urgente: 'Urgente hoy'
  };

  const ICONS = {
    legal: '⚖️',
    incident: '⚠️',
    competitive: '📉',
    pattern: '↻',
    operations: '◆',
    opportunity: '◇',
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

  function titleCaseTenant(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function sectionById(data, id) {
    return (data.sections || []).find(section => section.id === id) || { id, cards: [] };
  }

  function cardMeta(card) {
    const ctx = card.agent_context || {};
    const parts = [
      ctx.location,
      ctx.display_date,
      ctx.signal_count ? `${ctx.signal_count} señales` : null,
      ctx.risk_type || card.status
    ].filter(Boolean);

    return parts.join(' · ');
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
    add(left, el('div', 'product', 'NexusG · Señales activas'));
    add(left, el('h1', 'tenant', titleCaseTenant(data.tenant_id)));
    add(left, el('div', 'ops-subtitle', `${data.card_count || 0} prioridades activas · máximo visible ${data.max_cards || 12}`));

    const btn = add(inner, el('a', 'agent-btn', 'Abrir agente →'));
    btn.href = agentUrl(data);
    return header;
  }

  function renderEvidence(list, items = []) {
    items.forEach(item => add(list, el('li', '', item)));
  }

  function renderChildren(parent, children = []) {
    if (!children.length) return;
    const wrap = add(parent, el('div', 'ops-children'));
    add(wrap, el('div', 'ops-detail-label', 'Señales agrupadas'));
    children.slice(0, 3).forEach(child => {
      const row = add(wrap, el('div', 'ops-child'));
      add(row, el('strong', '', child.safe_label || child.headline || child.title || child.label || 'Señal relacionada'));
      if (child.summary || child.evidence_excerpt || child.evidence) add(row, el('span', '', child.summary || child.evidence_excerpt || child.evidence));
    });
  }

  function renderCard(card, data, opts = {}) {
    const details = el('details', `ops-card color-${card.color_key || 'gray'} ${opts.className || ''}`);
    details.dataset.cardId = card.id;

    const summary = add(details, el('summary', 'ops-card-summary'));
    add(summary, el('span', 'ops-icon', ICONS[card.icon_key] || ICONS[card.type] || '•'));
    const copy = add(summary, el('span', 'ops-copy'));
    add(copy, el('span', 'ops-headline', card.headline));
    const meta = cardMeta(card);
    if (meta) add(copy, el('span', 'ops-meta', meta));
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

  function renderUrgent(cards, data) {
    const section = el('section', 'ops-zone ops-zone-urgent');
    const head = add(section, el('div', 'ops-zone-head'));
    add(head, el('span', '', SECTION_LABELS.urgente));
    add(head, el('small', '', 'presión inmediata'));

    const grid = add(section, el('div', 'ops-urgent-grid'));
    cards.forEach((card, index) => {
      const size = index === 0 ? 'signal-large' : 'signal-strong';
      add(grid, renderCard(card, data, { className: size }));
    });

    return section;
  }

  function renderPressureField(cards, data) {
    const section = el('section', 'ops-zone ops-zone-field');
    const head = add(section, el('div', 'ops-zone-head'));
    add(head, el('span', '', 'Campo de presión'));
    add(head, el('small', '', `${cards.length} señales restantes`));

    const grid = add(section, el('div', 'ops-pressure-grid'));
    cards.forEach((card, index) => {
      const className = index % 5 === 1 ? 'signal-tall' : index % 7 === 3 ? 'signal-wide' : '';
      add(grid, renderCard(card, data, { className }));
    });

    if (!cards.length) {
      add(grid, el('div', 'ops-empty', 'Sin señales que superen umbral de acción.'));
    }

    return section;
  }

  function render(data) {
    const fragment = document.createDocumentFragment();
    add(fragment, renderHeader(data));

    const main = add(fragment, el('main', 'container ops-main'));
    const urgent = sectionById(data, 'urgente').cards;
    const pressureCards = [
      ...sectionById(data, 'tareas').cards,
      ...sectionById(data, 'importante').cards
    ];

    add(main, renderUrgent(urgent, data));
    add(main, renderPressureField(pressureCards, data));

    const mobileAgent = add(fragment, el('a', 'mobile-agent', 'Abrir agente ↗'));
    mobileAgent.href = agentUrl(data);

    return fragment;
  }

  return { render };
})();

window.PressureBoard = PressureBoard;
