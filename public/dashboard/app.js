const app = document.getElementById('app');

function clear() {
  app.replaceChildren();
}

function state(message) {
  clear();

  const node = document.createElement('div');
  node.className = 'state state-page';
  node.textContent = message;

  app.appendChild(node);
}

function render(data) {
  clear();
  app.appendChild(window.PressureBoard.render(data));
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const tenant_id = params.get('tenant_id');
  const view = params.get('view') || 'operational';

  if (!tenant_id) {
    state('Falta tenant_id en la URL.');
    return;
  }

  try {
    const url = `${window.DashboardConfig.API_BASE}?tenant_id=${encodeURIComponent(tenant_id)}&view=${encodeURIComponent(view)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      const message = data?.error === 'invalid_tenant_id'
        ? 'Tenant no válido.'
        : 'No se pudo cargar el dashboard operacional.';

      state(message);
      return;
    }

    render(data);
  } catch (e) {
    state('No se pudo cargar el dashboard operacional.');
  }
}

init();
