window.fmt = (v, d = 2) => Number.isFinite(Number(v))
  ? Number(v).toLocaleString('es-CL', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    })
  : '—';

window.int = v => Number.isFinite(Number(v))
  ? Number(v).toLocaleString('es-CL')
  : '—';

window.signedInt = v => Number.isFinite(Number(v))
  ? `${Number(v) > 0 ? '+' : ''}${Number(v).toLocaleString('es-CL', { maximumFractionDigits: 0 })}`
  : '—';

window.delta = v => Number.isFinite(Number(v))
  ? `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}`
  : '—';

window.tone = v => Number(v) > 0
  ? 'good'
  : Number(v) < 0
    ? 'risk'
    : 'neutral';

window.trend = v => Number(v) > 0
  ? 'Mejora'
  : Number(v) < 0
    ? 'Deterioro'
    : 'Estable';

window.hasItems = items => Array.isArray(items) && items.length > 0;
