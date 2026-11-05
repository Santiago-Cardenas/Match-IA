// Configuración de la app con sesión (chats). Cambia aquí límites y textos; las IAs están en src/lib/ais.ts.

export const MAX_MESSAGE_CHARS = 4000;
/** Mensajes previos del chat que se envían como contexto a la IA. */
export const HISTORY_TURNS = 20;

/** Límites por usuario cada 24 h y globales (para no agotar la API gratuita). Solo cuentan respuestas exitosas. */
export const APP_LIMITS = {
  textoPorUsuario: 40,
  imagenPorUsuario: 6,
  textoGlobal: 1500,
  imagenGlobal: 150,
};

export const APP_MESSAGES = {
  limiteTexto: "Llegaste al límite de mensajes de hoy. Vuelve mañana para seguir probando.",
  limiteImagen: "Llegaste al límite de imágenes de hoy. Vuelve mañana para generar más.",
  ocupado: "Hay mucha demanda en este momento. Intenta de nuevo en unos segundos.",
  error: "No pudimos generar la respuesta. Intenta de nuevo.",
  bloqueado: "No podemos generar esa imagen. Prueba con otra descripción.",
};
