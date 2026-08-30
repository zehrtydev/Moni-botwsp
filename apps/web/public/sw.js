self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Moni no cachea HTML ni respuestas de Supabase: son datos privados y deben
// mantenerse siempre actualizados. El service worker solo habilita el modo
// instalable y deja que el navegador resuelva cada petición normalmente.
self.addEventListener("fetch", () => undefined);
