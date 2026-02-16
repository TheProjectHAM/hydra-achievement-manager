import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/**
 * Faz uma requisição com fallback para o frontend usando corsproxy.io
 * @param url URL original
 * @param options Opções da requisição
 * @returns Resposta do fetch
 */
export async function fetchWithFallback(url: string, options: any = {}) {
  try {
    // Tenta requisição direta via tauri plugin http (que ignora CORS no backend)
    const response = await tauriFetch(url, {
      ...options,
    });

    if (response.ok) {
      return response;
    }
    throw new Error(`Direct fetch failed with status: ${response.status}`);
  } catch (error) {
    console.warn(
      `Direct fetch failed for ${url}, trying corsproxy.io...`,
      error,
    );

    // Proxy via corsproxy.io
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

    // Simplifica options para o proxy (geralmente GET)
    // Usa window.fetch nativo
    return await window.fetch(proxyUrl, {
      ...options,
      // Remove headers que podem dar problema com o proxy se necessário
    });
  }
}
