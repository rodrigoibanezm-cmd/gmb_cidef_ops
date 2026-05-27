const app = document.getElementById('app');
const UI = window.DashboardComponents;

function clear() {
  app.replaceChildren();
}

function state(message) {
  clear();
  UI.add(app, UI.el('div', 'state state-page', message));
}

function desktop(data) {
  const wrap = UI.el('div', 'desktop-only');
  const main = UI.add(wrap, UI.el('div', 'container main'));
  const k = data.kpis;

  const kpis = UI.add(main, UI.el('div', 'grid kpi-grid'));
  UI.add(kpis, UI.kpi('Nota promedio', fmt(k.average_rating), `${delta(k.rating_delta)} vs. ayer`, 'tint-blue'));
  UI.add(kpis, UI.kpi('Tendencia', trend(k.rating_delta), `${delta(k.rating_delta)} pts`, Number(k.rating_delta) < 0 ? 'tint-red' : 'tint-green', tone(k.rating_delta)));
  UI.add(kpis, UI.kpi('Reviews', int(k.total_reviews), `${signedInt(k.reviews_delta)} vs. ayer`, 'tint-violet'));
  UI.add(kpis, UI.kpi('Pierden su zona', int(data.competitive_summary?.risk_count), 'Riesgo competitivo local', 'tint-red', 'risk'));
  UI.add(kpis, UI.kpi('Bajo umbral', int(k.critical_stores), 'Rating menor a 4.0', 'tint-red', 'risk'));
  UI.add(kpis, UI.kpi('Mejor tienda', k.best_store?.name || '—', `${fmt(k.best_store?.rating)} · ${k.best_store?.location || ''}`, 'tint-green', 'small'));

  const alerts = UI.qualitativeAlerts(data);
  if (alerts) UI.add(main, alerts);

  const comp = UI.competitiveRisk(data);
  if (comp) UI.add(main, comp);

  UI.add(main, UI.actionCards(data));

  const ctx = UI.add(main, UI.el('div', 'grid context-grid'));
  UI.add(ctx, UI.redFlags(data.red_flags));
  UI.add(ctx, UI.summary(data));

  const ops = UI.add(main, UI.el('div', 'grid operational-grid'));
  if (hasItems(data.movements?.up)) UI.add(ops, UI.listCard('Mayores alzas', data.movements.up, 5, 'tint-green'));
  if (hasItems(data.movements?.down)) UI.add(ops, UI.listCard('Mayores bajas', data.movements.down, 5, 'tint-red'));
  UI.add(ops, UI.listCard('Top 5', data.rankings?.top));
  UI.add(ops, UI.listCard('Bottom 5', data.rankings?.bottom));

  const footer = UI.add(main, UI.el('footer', 'footer'));
  UI.add(footer, UI.el('span', '', 'Fuente: Google Places / Neon'));
  UI.add(footer, UI.el('span', '', data.source || 'runtime'));

  return wrap;
}

function mobile(data) {
  const wrap = UI.el('div', 'mobile-only');
  const main = UI.add(wrap, UI.el('div', 'container main mobile-stack'));
  const k = data.kpis;
  const p = data.mobile_priority || {};

  const hero = UI.add(main, UI.el('section', 'hero-card'));
  UI.add(hero, UI.el('div', 'micro', 'Nota promedio'));
  UI.add(hero, UI.el('div', 'hero-rating', fmt(k.average_rating)));

  const since = UI.add(hero, UI.el('div', 'hero-since'));
  UI.add(since, UI.el('span', '', `Reviews ${signedInt(k.reviews_delta)} vs. ayer`));
  UI.add(since, UI.el('span', '', `Rating ${delta(k.rating_delta)} pts`));

  const crit = UI.add(hero, UI.el('div', 'hero-critical'));
  UI.add(crit, UI.el('strong', '', int(data.competitive_summary?.risk_count)));
  crit.append(' zonas con riesgo');
  UI.add(hero, UI.el('div', 'hero-headline', data.competitive_summary?.headline || p.headline || data.executive_summary?.mobile_hint || ''));

  const alerts = UI.qualitativeAlerts(data);
  if (alerts) UI.add(main, alerts);

  const comp = UI.competitiveRisk(data);
  if (comp) UI.add(main, comp);

  UI.add(main, UI.actionCards(data));
  UI.add(main, UI.el('div', 'micro risk', '⚠ Tiendas bajo umbral'));
  UI.add(main, UI.redFlags(data.red_flags));
  if (hasItems(data.movements?.down)) UI.add(main, UI.listCard('Mayores bajas', data.movements.down, 3));
  UI.add(main, UI.summary(data, true));
  if (hasItems(data.movements?.up)) UI.add(main, UI.listCard('Mayores alzas', data.movements.up, 3));
  UI.add(main, UI.listCard('Top 5', data.rankings?.top, 5));
  UI.add(main, UI.listCard('Bottom 5', data.rankings?.bottom, 5));

  const btn = UI.add(wrap, UI.el('a', 'mobile-agent', 'Abrir agente ↗'));
  btn.href = agentUrl(data);

  return wrap;
}

function render(data) {
  clear();
  UI.add(app, UI.makeHeader(data));
  UI.add(app, desktop(data));
  UI.add(app, mobile(data));
}

async function init() {
  const tenant_id = new URLSearchParams(window.location.search).get('tenant_id');
  if (!tenant_id) return state('Falta tenant_id en la URL.');

  try {
    const res = await fetch(`${window.DashboardConfig.API_BASE}?tenant_id=${encodeURIComponent(tenant_id)}&view=full`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      return state(data?.error === 'invalid_tenant_id' ? 'Tenant no válido.' : 'No se pudo cargar el dashboard.');
    }

    render(data);
  } catch (e) {
    state('No se pudo cargar el dashboard.');
  }
}

init();
