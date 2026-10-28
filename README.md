# Calendario EdTech · premios

Calendario de premiaciones de educación y tecnología, con avisos para mantenerlo al día.
Sitio estático (sin build) pensado para `calendario.yohual.com`.

## Cómo se actualiza
- Todos los datos viven en `awards.json`. Edita ahí fechas, estados y textos.
- Al revisar un premio: `node scripts/marcar.mjs 3 7` (por id) o `node scripts/marcar.mjs todos`.
- `git add -A && git commit -m "Actualizar premios" && git push` → Vercel publica solo.

## Qué vigila (cada día, 8:00 a.m. CDMX, vía GitHub Actions)
- Cierres/aperturas a 30, 14, 7, 1 y 0 días.
- Fechas ya pasadas con estado aún "Abierta"/"Próxima apertura".
- Fechas sin día exacto cuando llega su mes.
- Fichas sin verificar en más de 60 días.
- Cambios en las páginas oficiales (fechas y palabras clave como deadline/closed/open).
  La primera corrida solo guarda la línea base.
- Todo llega en un solo correo (Resend, remitente `avisos@yohual.com`).

## Configuración única en GitHub (Settings → Secrets and variables → Actions)
- `RESEND_API_KEY`: tu llave de Resend.
- `ALERT_TO`: el correo donde quieres recibir los avisos.
Prueba manual: pestaña Actions → "Vigilancia diaria" → Run workflow.

## Calendario suscribible
`https://calendario.yohual.com/calendario.ics` (se regenera solo).
- Apple/iOS y Outlook respetan las alarmas incluidas (14, 7 y 1 día antes, 9:00).
- Google Calendar ignora alarmas de calendarios suscritos: en su configuración,
  activa "Notificaciones de evento" para este calendario.

## Pruebas locales
    node scripts/vigilancia.mjs --no-fetch --today=2026-11-18 --dry
    node scripts/build-ics.mjs
    python3 -m http.server 8000
