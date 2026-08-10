// Configuração de runtime para hospedagem estática (HostGator/cPanel etc.).
// Permite trocar endpoint da API sem rebuild do frontend.
window.__SPI_CONFIG__ = window.__SPI_CONFIG__ || {};
// API_URL is injected at build time via VITE_API_URL — do not hardcode here.
// N8N_WEBHOOK_URL removido — use a variável de ambiente VITE_N8N_WEBHOOK_URL no build.
