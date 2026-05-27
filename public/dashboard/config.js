window.DashboardConfig = {
  API_BASE: '/api/dashboard',
  AGENT_URLS: {
    beauty_plus: 'https://chatgpt.com/g/g-69f80b7e57708191a5141be066b0bd0c-agente-analisis-reputacion'
  }
};

window.agentUrl = function agentUrl(data) {
  return window.DashboardConfig.AGENT_URLS[data.tenant_id] || '#';
};
