// Genera calendario.ics (suscribible en Google Calendar / Apple / Outlook). Uso: node scripts/build-ics.mjs
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('awards.json', 'utf8'));
const stamp = d.meta.updated.replaceAll('-', '') + 'T120000Z';
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const fold = l => { const o = []; while (l.length > 74) { o.push(l.slice(0, 74)); l = ' ' + l.slice(74); } o.push(l); return o.join('\r\n'); };
const ymd = s => s.replaceAll('-', '');
const plus1 = s => { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10).replaceAll('-', ''); };
// alarma a las 9:00 hora local, N días antes de un evento de día completo
const alarm = (days, txt) => ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(txt), 'TRIGGER:-P' + (days - 1) + 'DT15H', 'END:VALARM'];
const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yohual.com//Calendario EdTech//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  'X-WR-CALNAME:Calendario EdTech · premios', 'X-WR-TIMEZONE:America/Mexico_City', 'X-PUBLISHED-TTL:PT12H', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H'];
let n = 0;
for (const a of d.awards) for (const [i, e] of a.events.entries()) {
  if (e.kind === 'Histórico') continue;
  let start, exact = e.date.length === 10;
  if (exact) start = e.date; else if (e.date.includes('Q')) start = e.date.slice(0, 4) + '-10-01'; else start = e.date + '-01';
  const t = (exact ? '' : '≈ ') + a.name + ' · ' + e.kind;
  const ev = ['BEGIN:VEVENT', `UID:${a.id}-${i}-${e.date}@calendario.yohual.com`, 'DTSTAMP:' + stamp,
    'DTSTART;VALUE=DATE:' + ymd(start), 'DTEND;VALUE=DATE:' + plus1(exact && e.end && e.end.length === 10 ? e.end : start), 'SUMMARY:' + esc(t),
    'DESCRIPTION:' + esc(e.label + (exact ? '' : ' (día por confirmar)') + '\n' + a.url), 'URL:' + a.url, 'TRANSP:TRANSPARENT'];
  if (exact && ['Cierre', 'Apertura'].includes(e.kind)) for (const k of [14, 7, 1]) ev.push(...alarm(k, `${a.name}: ${e.kind.toLowerCase()} en ${k} día(s)`));
  ev.push('END:VEVENT'); L.push(...ev); n++;
}
// recordatorio mensual de revisión
L.push('BEGIN:VEVENT', 'UID:revision-mensual@calendario.yohual.com', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:20261101', 'DTEND;VALUE=DATE:20261102',
  'RRULE:FREQ=MONTHLY;BYMONTHDAY=1', 'SUMMARY:Revisar calendario EdTech', 'DESCRIPTION:' + esc('Repasa las fichas sin verificar y los avisos del mes.'), 'TRANSP:TRANSPARENT',
  ...alarm(1, 'Revisar calendario EdTech').map(x => x.replace('TRIGGER:-P0DT15H', 'TRIGGER:PT9H')), 'END:VEVENT', 'END:VCALENDAR');
fs.writeFileSync('calendario.ics', L.map(fold).join('\r\n') + '\r\n');
console.log(n + ' eventos + recordatorio mensual → calendario.ics');
