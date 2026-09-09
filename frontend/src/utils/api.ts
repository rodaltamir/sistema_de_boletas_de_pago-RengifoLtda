/**
 * Retorna la URL base para las peticiones a la API del backend.
 * En el navegador, utiliza dinámicamente el hostname actual (localhost, Rengifo_Ltda, o IP local de red)
 * en el puerto 8000, evitando errores de CORS, resolución DNS o redirecciones.
 */
export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    // Si se configuró una URL remota de producción diferente a entornos locales, usarla
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("Rengifo_Ltda") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }
    const host = window.location.hostname || "localhost";
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${host}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}
