const app = document.getElementById('app');
const {
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
} = window.DashboardComponents;

function clear() {
  app.replaceChildren();
}

function state(message) {
  clear();
  add(app, el('div', 'state state-page', message));
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

  const alerts = qualitativeAlerts(data);
  if (alerts) add(main, alerts);

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
  add(footer, el('span', '', 'Fuente: Google Places / Neon'));
  add(footer, el('span', '', data.source || 'runtime'));

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

  const alerts = qualitativeAlerts(data);
  if (alerts) add(main, alerts);

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
  btn.href = agentUrl(data);

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
