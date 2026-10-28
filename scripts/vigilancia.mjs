// Vigilancia diaria del calendario: recordatorios + cambios en páginas oficiales.
// Uso:  node scripts/vigilancia.mjs [--today=YYYY-MM-DD] [--no-fetch] [--dry]
import fs from 'node:fs';
import crypto from 'node:crypto';

const arg = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const flag = k => process.argv.includes('--' + k);
const TODAY = arg('today') || new Date().toISOString().slice(0, 10);
const DRY = flag('dry') || !process.env.RESEND_API_KEY || !process.env.ALERT_TO;
const STALE_DAYS = 60, REMIND = [30, 14, 7, 1, 0], FAILS_BEFORE_ALERT = 3;

const data = JSON.parse(fs.readFileSync('awards.json', 'utf8'));
const state = fs.existsSync('state.json') ? JSON.parse(fs.readFileSync('state.json', 'utf8')) : {};
state.hashes ??= {}; state.sent ??= {}; state.fails ??= {};

const day = s => Math.floor(Date.parse(s + 'T00:00:00Z') / 864e5);
const t0 = day(TODAY);
const alerts = [];                      // { icon, title, body, link }
const once = key => { if (state.sent[key]) return false; state.sent[key] = TODAY; return true; };

for (const a of data.awards) {
  const pending = ['Abierta', 'Próxima apertura'].includes(a.status);
  for (const e of a.events) {
    if (e.kind === 'Histórico') continue;
    if (e.date.length === 10) {
      const left = day(e.date) - t0;
      if (['Cierre', 'Apertura'].includes(e.kind) && REMIND.includes(left) && once(`r|${a.id}|${e.date}|${left}`)) {
        const when = left === 0 ? 'HOY' : left === 1 ? 'mañana' : `en ${left} días`;
        alerts.push({ icon: '⏰', title: `${a.name}: ${e.kind.toLowerCase()} ${when}`, body: `${e.label} (${e.date}). Verifica las bases y actualiza la ficha.`, link: a.url });
      }
      if (['Cierre', 'Apertura'].includes(e.kind) && left < 0 && left > -15 && pending && once(`o|${a.id}|${e.date}`)) {
        alerts.push({ icon: '🔄', title: `${a.name}: pasó "${e.label}" y el estado sigue "${a.status}"`, body: 'Actualiza el estado y las fechas de la siguiente edición.', link: a.url });
      }
    } else {
      // fecha sin día exacto: avisar al empezar el mes (o el trimestre)
      const ym = e.date.includes('Q') ? e.date.slice(0, 4) + '-10' : e.date;
      if (TODAY.slice(0, 7) === ym && once(`m|${a.id}|${e.date}`)) {
        alerts.push({ icon: '📅', title: `${a.name}: este mes tiene una fecha sin día exacto`, body: `${e.label} (${e.date}). Busca el día y complétalo en awards.json.`, link: a.url });
      }
    }
  }
  const age = t0 - day(a.verified || '2000-01-01');
  if (age > STALE_DAYS && once(`s|${a.id}|${TODAY.slice(0, 7)}`)) {
    alerts.push({ icon: '🧭', title: `${a.name}: sin verificar hace ${age} días`, body: 'Revisa su página oficial y marca la ficha como verificada (node scripts/marcar.mjs ' + a.id + ').', link: a.url });
  }
}

// ---- Vigilancia de páginas oficiales ----
const MES = 'january|february|march|april|may|june|july|august|september|october|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|ene|abr|ago|dic';
const RE_FECHA = new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:de\\s+)?(?:${MES})\\.?(?:\\s+(?:de\\s+)?20\\d{2})?|(?:${MES})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+20\\d{2})?|20\\d{2}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/20\\d{2})\\b`, 'gi');
const RE_ESTADO = /\b(call for entries|now open|applications? (?:are )?(?:now )?open|entries (?:are )?(?:now )?open|submissions? (?:are )?(?:now )?open|deadline|closed|closing|registration|convocatoria(?:s)? (?:abierta|cerrada)|inscripciones (?:abiertas|cerradas)|abierta|cerrada|cierre)\b/gi;

export function extraerSenales(html) {
  const txt = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const fechas = [...new Set((txt.match(RE_FECHA) || []).map(norm))].sort();
  const estados = [...new Set((txt.match(RE_ESTADO) || []).map(norm))].sort();
  return { fechas, estados };
}

async function vigilar() {
  const urls = new Map();
  for (const a of data.awards) {
    for (const u of [a.url, data.sourceUrls?.[a.id]].filter(Boolean)) if (!urls.has(u)) urls.set(u, a);
  }
  for (const [url, a] of urls) {
    try {
      const ctl = AbortSignal.timeout(25000);
      const r = await fetch(url, { signal: ctl, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; CalendarioEdTechBot/1.0; +https://yohual.com)', accept: 'text/html,*/*' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const ct = r.headers.get('content-type') || '';
      if (!/html|text/i.test(ct)) { state.fails[url] = 0; continue; }       // PDFs, etc.: no se comparan
      const sig = extraerSenales(await r.text());
      const hash = crypto.createHash('sha256').update(JSON.stringify(sig)).digest('hex');
      const prev = state.hashes[url];
      state.fails[url] = 0;
      if (!prev) { state.hashes[url] = { hash, ...sig, since: TODAY }; continue; }       // línea base
      if (prev.hash !== hash) {
        const add = [...sig.fechas, ...sig.estados].filter(x => ![...prev.fechas, ...prev.estados].includes(x));
        const del = [...prev.fechas, ...prev.estados].filter(x => ![...sig.fechas, ...sig.estados].includes(x));
        state.hashes[url] = { hash, ...sig, since: TODAY };
        alerts.push({ icon: '🛰️', title: `${a.name}: cambió su página oficial`, body: `Nuevo: ${add.slice(0, 8).join(' · ') || '—'}\nYa no aparece: ${del.slice(0, 8).join(' · ') || '—'}`, link: url });
      }
    } catch (err) {
      state.fails[url] = (state.fails[url] || 0) + 1;
      if (state.fails[url] === FAILS_BEFORE_ALERT) {
        alerts.push({ icon: '⚠️', title: `${a.name}: su página no responde (${FAILS_BEFORE_ALERT} días seguidos)`, body: `${err.message}. Puede ser un bloqueo al bot: revísala a mano.`, link: url });
      }
    }
  }
}

if (!flag('no-fetch')) await vigilar();

// ---- Envío ----
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const texto = alerts.map(x => `${x.icon} ${x.title}\n${x.body}\n${x.link}`).join('\n\n');
console.log(`[${TODAY}] ${alerts.length} aviso(s)${DRY ? ' (modo prueba: no se envía correo)' : ''}`);
if (alerts.length) console.log('\n' + texto);

if (alerts.length && !DRY) {
  const html = `<div style="background:#04060c;padding:28px;font-family:system-ui,sans-serif;color:#ece8de"><div style="max-width:560px;margin:auto"><p style="letter-spacing:.2em;font-size:11px;color:#e6c590;margin:0 0 6px">OBSERVATORIO · CALENDARIO EDTECH</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 18px">${alerts.length} aviso${alerts.length > 1 ? 's' : ''} para revisar</h1>${alerts.map(x => `<div style="border-left:2px solid #e6c590;background:#0b0f1a;padding:12px 14px;margin:0 0 10px;border-radius:6px"><b>${x.icon} ${esc(x.title)}</b><br><span style="color:#a6aebf;font-size:13px;white-space:pre-line">${esc(x.body)}</span><br><a href="${esc(x.link)}" style="color:#e6c590;font-size:13px">Abrir fuente ↗</a></div>`).join('')}<p style="color:#7d869c;font-size:12px">Edita <code>awards.json</code> y marca cada premio revisado con <code>node scripts/marcar.mjs ID</code>.</p></div></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Calendario EdTech <avisos@yohual.com>', to: [process.env.ALERT_TO], subject: `Calendario EdTech · ${alerts.length} aviso${alerts.length > 1 ? 's' : ''} (${TODAY})`, html, text: texto })
  });
  if (!r.ok) { console.error('Resend falló:', r.status, await r.text()); process.exit(1); }
  console.log('Correo enviado.');
}

if (!DRY || flag('save')) fs.writeFileSync('state.json', JSON.stringify(state, null, 1) + '\n');
