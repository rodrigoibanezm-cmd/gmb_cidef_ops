const PressureBoard = (() => {
  const VIEW_CONFIG = {
    operational: {
      product: 'NexusG · Presión operacional',
      subtitle: 'Decisiones comprimidas para actuar sin revisar un dashboard.',
      promptTitle: 'Analiza esta prioridad operacional',
      areas: [
        { id: 'urgente', label: 'Urgente hoy', note: 'requiere acción inmediata', open: true },
        { id: 'importante', label: 'Importante', note: 'puede escalar esta semana' },
        { id: 'tareas', label: 'Tareas', note: 'seguimiento operativo' },
        { id: 'monitorear', label: 'Monitorear', note: 'señales bajo observación' }
      ]
    },
    competitive: {
      product: 'NexusG · Presión competitiva',
      subtitle: 'Movimientos del mercado que requieren reacción antes de volverse posición.',
      promptTitle: 'Analiza esta presión competitiva',
      areas: [
        { id: 'erosion', label: 'Erosión', note: 'ventaja debilitándose', open: true },
        { id: 'momentum_rival', label: 'Momentum rival', note: 'competidor ganando tracción' },
        { id: 'atributo_disputa', label: 'Atributo en disputa', note: 'diferenciación bajo presión' },
        { id: 'presion_emergente', label: 'Presión emergente', note: 'señal competitiva temprana' }
      ]
    }
  };

  function viewConfig(data) {
    return VIEW_CONFIG[data.view] || VIEW_CONFIG.operational;
  }

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

  function signalWeight(card) {
    const ctx = card.agent_context || {};
    const count = Number(ctx.signal_count || 1);
    const negative = Number(ctx.negative_count || 0);
    const positive = Number(ctx.positive_count || 0);

    if (card.section === 'urgente' || card.section === 'erosion') return 'weight-urgent';
    if (count >= 4 || negative >= 3) return 'weight-cluster';
    if (card.type === 'oportunidad' || (positive > 0 && negative === 0)) return 'weight-light';
    return 'weight-normal';
  }

  function cardMeta(card) {
    const ctx = card.agent_context || {};
    const risk = ctx.risk_type && ctx.risk_type !== 'none' ? ctx.risk_type : card.status;
    const parts = [
      ctx.location,
      ctx.attribute,
      ctx.display_date,
      ctx.signal_count ? `${ctx.signal_count} señales` : null,
      risk
    ].filter(Boolean);

    return parts.join(' · ');
  }

  function areaTemperature(cards) {
    if (cards.some(card => card.color_key === 'red')) return 'red';
    if (cards.some(card => card.color_key === 'orange')) return 'orange';
    if (cards.some(card => card.color_key === 'yellow')) return 'yellow';
    if (cards.some(card => card.color_key === 'blue')) return 'blue';
    return 'gray';
  }

  function agentUrl(data) {
    return window.DashboardConfig.AGENT_URLS[data.tenant_id] || '#';
  }

  function agentPrompt(data, card) {
    if (!card) return '';
    const cfg = viewConfig(data);
    return [
      `${cfg.promptTitle} del tenant ${data.tenant_id}:`,
      card.headline,
      `Por qué importa: ${card.why_it_matters}`,
      card.risk ? `Riesgo: ${card.risk}` : null,
      `Acción sugerida: ${card.suggested_action}`,
      card.evidence?.length ? `Evidencia:\n- ${card.evidence.join('\n- ')}` : null
    ].filter(Boolean).join('\n');
  }

  function showToast(message) {
    let toast = document.querySelector('.ops-toast');

    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'ops-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('is-visible');

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2600);
  }

  async function copyText(value) {
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (e) {
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(input);
      return ok;
    }
  }

  function wireAgentLink(link, data, card) {
    link.href = agentUrl(data);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    link.addEventListener('click', async event => {
      const prompt = agentPrompt(data, card);
      if (prompt) {
        const copied = await copyText(prompt);
        if (copied) showToast('Prompt copiado. Pégalo en el agente.');
        link.textContent = copied ? 'Prompt copiado · abrir agente →' : 'Abrir agente →';
        setTimeout(() => { link.textContent = card ? 'Preguntar sobre esto →' : 'Abrir agente →'; }, 1800);
      }
    });
  }

  function renderViewSwitch(data) {
    const wrap = el('nav', 'ops-view-switch');
    const views = [
      { id: 'operational', label: 'Presión operacional' },
      { id: 'competitive', label: 'Presión competitiva' }
    ];

    views.forEach(view => {
      const params = new URLSearchParams(window.location.search);
      params.set('tenant_id', data.tenant_id);
      params.set('view', view.id);

      const link = add(wrap, el('a', view.id === data.view ? 'is-active' : '', view.label));
      link.href = `${window.location.pathname}?${params.toString()}`;
    });

    return wrap;
  }

  function renderHeader(data) {
    const cfg = viewConfig(data);
    const header = el('header', 'ops-header');
    const inner = add(header, el('div', 'ops-header-inner'));
    const left = add(inner, el('div'));
    add(left, el('div', 'product', cfg.product));
    add(left, el('h1', 'tenant', titleCaseTenant(data.tenant_id)));
    add(left, el('div', 'ops-subtitle', cfg.subtitle));
    add(left, renderViewSwitch(data));

    const btn = add(inner, el('a', 'agent-btn', 'Abrir agente →'));
    wireAgentLink(btn, data);
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
    const weight = signalWeight(card);
    const details = el('details', `ops-card color-${card.color_key || 'gray'} ${weight} ${opts.className || ''}`);
    details.dataset.cardId = card.id;

    const summary = add(details, el('summary', 'ops-card-summary'));
    const copy = add(summary, el('span', 'ops-copy'));
    add(copy, el('span', 'ops-headline', card.headline));
    const meta = cardMeta(card);
    if (meta) add(copy, el('span', 'ops-meta', meta));
    add(summary, el('span', 'ops-chevron', '›'));

    const body = add(details, el('div', 'ops-card-body'));

    const why = add(body, el('section', 'ops-detail-block'));
    add(why, el('div', 'ops-detail-label', 'Por qué importa'));
    add(why, el('p', '', card.why_it_matters));

    if (card.risk) {
      const risk = add(body, el('section', 'ops-detail-block'));
      add(risk, el('div', 'ops-detail-label', 'Riesgo'));
      add(risk, el('p', '', card.risk));
    }

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
    wireAgentLink(ask, data, card);

    details.addEventListener('toggle', () => {
      if (!details.open) return;
      document.querySelectorAll('.ops-card[open]').forEach(openCard => {
        if (openCard !== details) openCard.open = false;
      });
    });

    return details;
  }

  function renderAreaDeck(areas) {
    const deck = el('section', 'ops-area-deck');

    areas.forEach(area => {
      const button = add(deck, el('button', `ops-area-pill color-${area.temperature}`));
      button.type = 'button';
      button.dataset.areaId = area.id;
      if (area.open) button.classList.add('is-active');

      add(button, el('span', 'ops-area-count', String(area.cards.length)));
      const copy = add(button, el('span', 'ops-area-copy'));
      add(copy, el('strong', '', area.label));
      add(copy, el('small', '', area.note));
    });

    return deck;
  }

  function renderAreaDetail(area, data) {
    const detail = el('section', `ops-area-detail color-${area.temperature}`);
    detail.dataset.areaId = area.id;
    if (area.open) detail.classList.add('is-active');

    const head = add(detail, el('div', 'ops-zone-head'));
    add(head, el('span', '', area.label));
    add(head, el('small', '', `${area.cards.length} señales`));

    const grid = add(detail, el('div', 'ops-pressure-grid'));
    area.cards.forEach((card, index) => {
      const className = index === 0 && area.open ? 'is-primary' : '';
      add(grid, renderCard(card, data, { className }));
    });

    if (!area.cards.length) {
      add(grid, el('div', 'ops-empty', 'Sin señales que superen umbral de acción.'));
    }

    return detail;
  }

  function attachAreaBehavior(root) {
    const buttons = [...root.querySelectorAll('.ops-area-pill')];
    const details = [...root.querySelectorAll('.ops-area-detail')];

    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.areaId;
        buttons.forEach(item => item.classList.toggle('is-active', item === button));
        details.forEach(item => item.classList.toggle('is-active', item.dataset.areaId === id));
      });
    });
  }

  function render(data) {
    const cfg = viewConfig(data);
    const fragment = document.createDocumentFragment();
    add(fragment, renderHeader(data));

    const main = add(fragment, el('main', 'container ops-main'));
    const areas = cfg.areas
      .map(config => {
        const cards = sectionById(data, config.id).cards;
        return { ...config, cards, temperature: areaTemperature(cards) };
      })
      .filter(area => area.cards.length || area.open);

    add(main, renderAreaDeck(areas));
    areas.forEach(area => add(main, renderAreaDetail(area, data)));
    attachAreaBehavior(main);

    const mobileAgent = add(fragment, el('a', 'mobile-agent', 'Abrir agente ↗'));
    wireAgentLink(mobileAgent, data);

    return fragment;
  }

  return { render };
})();

window.PressureBoard = PressureBoard;
