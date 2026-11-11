/* Avisos por correo del calendario.
 *
 * La cuenta es la misma que en los demás sitios de yohual.com: se verifica el correo una vez
 * (acceso.yohual.com) y cada servicio pide su propio consentimiento. Aquí solo se guarda,
 * en el servidor, la lista de premios que la persona sigue.
 */
(() => {
  'use strict';
  const API = 'https://acceso.yohual.com';
  const SERVICIO = 'calendario';
  const VERSION_TEXTO = '2026-11-v1';   // debe coincidir con el servidor; si cambia el texto, sube ambas

  const BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
  const $ = (id) => document.getElementById(id);
  const S = { cargado: false, email: null, consentimiento: false, claves: new Set(), pendiente: null, ocupado: false };
  let dlg = null, paso = 'correo', correoEnCurso = '', ultimoFoco = null;

  async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
    let r;
    try {
      r = await fetch(API + ruta, {
        method: metodo, credentials: 'include',
        headers: cuerpo ? { 'content-type': 'application/json' } : undefined,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
    } catch (e) {
      const err = new Error('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.');
      err.estado = 0; throw err;
    }
    let datos = null;
    try { datos = await r.json(); } catch (e) { /* sin cuerpo */ }
    if (!r.ok) {
      const err = new Error((datos && datos.detail) || 'No pudimos completar la acción. Inténtalo de nuevo.');
      err.estado = r.status; throw err;
    }
    return datos;
  }

  const enSesion = () => Boolean(S.email);
  const listo = () => enSesion() && S.consentimiento;
  const repintar = () => { pintarBarra(); if (typeof render === 'function' && typeof awards !== 'undefined' && awards.length) render(); refoco(); };

  function refoco() {
    if (!ultimoFoco) return;
    const { id, clase } = ultimoFoco; ultimoFoco = null;
    const b = document.querySelector('[data-seguir="' + id + '"].' + clase);
    if (b) b.focus();
  }

  // ---------- Botones que pinta index.html ----------
  const sigue = (id) => S.claves.has(String(id));
  function botonTarjeta(id) {
    const on = sigue(id);
    return '<button type="button" class="aw-follow" data-seguir="' + id + '" aria-pressed="' + on + '" aria-label="' +
      (on ? 'Dejar de seguir este premio' : 'Seguir este premio y recibir avisos por correo') + '" title="' +
      (on ? 'Siguiendo · toca para dejar de seguir' : 'Recibir avisos por correo') + '">' + BELL + '</button>';
  }
  function botonCuerpo(id) {
    const on = sigue(id);
    return '<button type="button" class="al-btn" data-seguir="' + id + '" aria-pressed="' + on + '">' + BELL + '<span>' +
      (on ? 'Siguiendo este premio' : 'Avisarme por correo') + '</span></button>';
  }

  // ---------- Barra del encabezado ----------
  function pintarBarra(mensaje, esError) {
    const bar = $('alertas'); if (!bar) return;
    bar.className = 'al-bar';
    bar.textContent = '';
    if (listo()) {
      const n = S.claves.size;
      const t = document.createElement('span');
      t.innerHTML = BELL.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px;fill:none;stroke:currentColor;stroke-width:1.7"');
      const b = document.createElement('b'); b.textContent = n === 1 ? 'Sigues 1 premio' : 'Sigues ' + n + ' premios';
      t.appendChild(b);
      bar.appendChild(t);
      const c = document.createElement('span'); c.textContent = 'Avisos a ' + S.email; bar.appendChild(c);
      if (n) bar.appendChild(enlace('Dejar de seguir todos', quitarTodos));
      bar.appendChild(enlace('Cerrar sesión', salir));
    } else {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'al-main'; b.innerHTML = BELL + '<span>Recibir avisos por correo</span>';
      b.addEventListener('click', () => abrir());
      bar.appendChild(b);
      const t = document.createElement('span');
      t.textContent = enSesion() ? 'Falta aceptar el aviso de privacidad para activar los recordatorios.'
        : 'Elige los premios que quieres seguir y te recordamos sus cierres y aperturas.';
      bar.appendChild(t);
    }
    const m = document.createElement('span');
    m.className = 'al-msg' + (esError ? ' err' : ''); m.setAttribute('role', esError ? 'alert' : 'status');
    if (mensaje) m.textContent = mensaje;
    bar.appendChild(m);
  }
  function enlace(texto, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'al-link'; b.textContent = texto;
    b.addEventListener('click', fn); return b;
  }

  // ---------- Acciones ----------
  async function guardar(nuevas, mensajeOk) {
    const antes = S.claves;
    S.claves = nuevas; repintar();
    try {
      const r = await api('/api/suscripciones/' + SERVICIO, { metodo: 'PUT', cuerpo: { claves: [...nuevas].sort() } });
      S.claves = new Set(r.claves);
      repintar();
      if (mensajeOk) pintarBarra(mensajeOk);
    } catch (e) {
      S.claves = antes; repintar();
      if (e.estado === 401) { S.email = null; S.consentimiento = false; pintarBarra(); abrir(); }
      else pintarBarra(e.message, true);
    }
  }

  function alternar(id) {
    const clave = String(id);
    if (!listo()) { S.pendiente = clave; abrir(); return; }
    const nuevas = new Set(S.claves);
    if (nuevas.has(clave)) nuevas.delete(clave); else nuevas.add(clave);
    guardar(nuevas, nuevas.has(clave) ? 'Listo: te avisaremos antes de las fechas importantes.' : 'Dejaste de seguir este premio.');
  }
  const quitarTodos = () => guardar(new Set(), 'Dejaste de seguir todos los premios.');
  async function salir() {
    try { await api('/api/salir', { metodo: 'POST', cuerpo: {} }); } catch (e) { /* si falla, igual se limpia la vista */ }
    S.email = null; S.consentimiento = false; S.claves = new Set(); S.pendiente = null;
    repintar(); pintarBarra('Cerraste sesión.');
  }

  // ---------- Diálogo de acceso ----------
  function construirDialogo() {
    dlg = document.createElement('dialog');
    dlg.className = 'al-dlg';
    dlg.setAttribute('aria-labelledby', 'al-titulo');
    dlg.addEventListener('close', () => { S.pendiente = S.pendiente && listo() ? null : S.pendiente; });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
  }

  function aviso(texto, esError) {
    const a = dlg.querySelector('.al-aviso'); if (!a) return;
    a.textContent = texto || ''; a.className = 'al-aviso' + (esError ? ' err' : '');
    a.setAttribute('role', esError ? 'alert' : 'status');
  }
  function ocupar(boton, si) { boton.disabled = si; S.ocupado = si; }

  function vista(nuevoPaso) {
    paso = nuevoPaso;
    const cerrar = '<button type="button" class="al-sec" data-cerrar>Ahora no</button>';
    if (paso === 'correo') {
      dlg.innerHTML = '<h2 id="al-titulo">Recibe avisos por correo</h2>' +
        '<p>Escribe tu correo y te mandamos un código para confirmarlo. Con la misma cuenta puedes usar los demás sitios de yohual.com.</p>' +
        '<form novalidate><label for="al-correo">Correo electrónico</label>' +
        '<input id="al-correo" type="email" autocomplete="email" inputmode="email" required>' +
        '<div class="al-fila"><button type="submit" class="al-ok">Enviarme el código</button>' + cerrar + '</div>' +
        '<div class="al-aviso" aria-live="polite"></div></form>';
      const f = dlg.querySelector('form'), i = dlg.querySelector('input');
      i.value = correoEnCurso;
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const correo = i.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(correo)) return aviso('Escribe un correo válido, por ejemplo nombre@correo.com.', true);
        const b = f.querySelector('.al-ok'); ocupar(b, true); aviso('Enviando…');
        try {
          await api('/api/registro', { metodo: 'POST', cuerpo: { email: correo, servicio: SERVICIO } });
          correoEnCurso = correo; vista('codigo');
        } catch (err) { aviso(err.message, true); } finally { ocupar(b, false); }
      });
      i.focus();
    } else if (paso === 'codigo') {
      dlg.innerHTML = '<h2 id="al-titulo">Revisa tu correo</h2><p></p>' +
        '<form novalidate><label for="al-cod">Código de 6 dígitos</label>' +
        '<input id="al-cod" class="al-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required>' +
        '<div class="al-fila"><button type="submit" class="al-ok">Confirmar</button>' +
        '<button type="button" class="al-sec" data-otro>Usar otro correo</button></div>' +
        '<div class="al-aviso" aria-live="polite"></div></form>';
      dlg.querySelector('p').textContent = 'Enviamos un código a ' + correoEnCurso + '. Vence en 10 minutos; revisa también el spam.';
      const f = dlg.querySelector('form'), i = dlg.querySelector('input');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codigo = i.value.replace(/\D/g, '');
        if (codigo.length !== 6) return aviso('Son 6 dígitos.', true);
        const b = f.querySelector('.al-ok'); ocupar(b, true); aviso('Verificando…');
        try {
          await api('/api/verificar', { metodo: 'POST', cuerpo: { email: correoEnCurso, codigo } });
          await cargar();
          if (listo()) return terminar();
          vista('consentimiento');
        } catch (err) { aviso(err.message, true); } finally { ocupar(b, false); }
      });
      dlg.querySelector('[data-otro]').addEventListener('click', () => vista('correo'));
      i.focus();
    } else if (paso === 'consentimiento') {
      dlg.innerHTML = '<h2 id="al-titulo">Antes de activar los avisos</h2>' +
        '<div class="al-cons"><strong>Qué guardamos y para qué</strong><ul>' +
        '<li>Tu correo y la lista de premios que sigues, solo para enviarte recordatorios de cierres y aperturas (30, 14, 7 y 1 día antes, y el mismo día).</li>' +
        '<li>No compartimos tu correo ni lo usamos para otra cosa.</li>' +
        '<li>Cada mensaje trae un enlace para darte de baja en un clic; también puedes dejar de seguir los premios desde esta página.</li>' +
        '<li>Es un servicio informativo: confirma siempre las bases oficiales antes de postular.</li></ul></div>' +
        '<div class="al-fila"><button type="button" class="al-ok" data-acepto>Acepto y quiero los avisos</button>' + cerrar + '</div>' +
        '<div class="al-aviso" aria-live="polite"></div>';
      const b = dlg.querySelector('[data-acepto]');
      b.addEventListener('click', async () => {
        ocupar(b, true); aviso('Guardando…');
        try {
          await api('/api/consentimiento', { metodo: 'POST', cuerpo: { version: VERSION_TEXTO, servicio: SERVICIO } });
          S.consentimiento = true; terminar();
        } catch (err) { aviso(err.message, true); } finally { ocupar(b, false); }
      });
      b.focus();
    }
    dlg.querySelectorAll('[data-cerrar]').forEach((x) => x.addEventListener('click', () => dlg.close()));
  }

  async function terminar() {
    dlg.close();
    const pend = S.pendiente; S.pendiente = null;
    if (pend) {
      const nuevas = new Set(S.claves); nuevas.add(pend);
      await guardar(nuevas, 'Listo: te avisaremos antes de las fechas importantes.');
    } else {
      repintar(); pintarBarra('Avisos activados. Toca la campana de un premio para seguirlo.');
    }
  }

  function abrir() {
    if (!dlg) construirDialogo();
    vista(!enSesion() ? 'correo' : (S.consentimiento ? 'correo' : 'consentimiento'));
    if (!dlg.open) dlg.showModal();
  }

  // ---------- Carga inicial ----------
  async function cargar() {
    try {
      const s = await api('/api/sesion?servicio=' + SERVICIO);
      S.email = s.email; S.consentimiento = Boolean(s.consentimiento);
      if (S.consentimiento) S.claves = new Set((await api('/api/suscripciones/' + SERVICIO)).claves);
    } catch (e) {
      S.email = null; S.consentimiento = false; S.claves = new Set();
    }
    S.cargado = true;
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seguir]');
    if (!b) return;
    ultimoFoco = { id: b.dataset.seguir, clase: b.classList.contains('aw-follow') ? 'aw-follow' : 'al-btn' };
    alternar(b.dataset.seguir);
  });

  window.Alertas = { botonTarjeta, botonCuerpo, sigue };
  pintarBarra();
  cargar().then(repintar);
})();
