// RP Coach · app instalable.
// Carga el diseño de la app desde el servidor de Apps Script y lo conecta por internet
// (fetch) en lugar de google.script.run. La sesión se guarda en el almacenamiento de
// esta web, que el iPhone conserva aunque se cierre la app.
(function () {
  'use strict';
  var API = 'https://script.google.com/macros/s/AKfycbymYHOfrzvOZaSPCqiitapWf48IZa7YicBtR9fDF5X18QWHUpYN_abmjaaU12JCDFgL/exec';
  try { var guardada = localStorage.getItem('rp:api'); if (/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(guardada || '')) API = guardada; } catch (e) {}
  var CLAVE_UI = 'rp:interfaz:v1';
  var CLAVE_CLIENTE = 'rp:cliente';
  var CODIGO = /^[A-Za-z0-9_-]{32,128}$/;

  // ---- Código personal del atleta: viene en el enlace la primera vez y se recuerda.
  var parametros = new URLSearchParams(location.search);
  var codigo = parametros.get('cliente');
  try {
    if (codigo && CODIGO.test(codigo)) localStorage.setItem(CLAVE_CLIENTE, codigo);
    else codigo = localStorage.getItem(CLAVE_CLIENTE);
  } catch (e) {}
  if (codigo && !CODIGO.test(codigo)) codigo = null;
  // Quita el código de la barra de direcciones (el icono se guarda sin él; ya está recordado).
  if (parametros.get('cliente') && window.history && history.replaceState) {
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }

  // ---- Llamadas al servidor.
  function llamar(accion, args) {
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion: accion, args: args }),
      redirect: 'follow',
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo conectar con el servidor.');
      return r.json();
    }, function () {
      throw new Error('Sin conexión. Revisa internet y vuelve a intentarlo.');
    }).then(function (res) {
      if (!res || res.ok !== true) throw new Error(res && res.error || 'No se pudo completar la operación.');
      return res.dato;
    });
  }

  // Sustituto de google.script.run / google.script.url con la misma forma de uso.
  function nuevaLlamada() {
    var exito = function () {}, fallo = function () {};
    var cadena = new Proxy({}, {
      get: function (_, nombre) {
        if (nombre === 'withSuccessHandler') return function (f) { exito = f || exito; return cadena; };
        if (nombre === 'withFailureHandler') return function (f) { fallo = f || fallo; return cadena; };
        if (nombre === 'withUserObject') return function () { return cadena; };
        if (typeof nombre !== 'string') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments).map(function (v) { return v === undefined ? null : v; });
          llamar(nombre, args).then(function (d) { exito(d); }, function (err) { fallo(err); });
        };
      }
    });
    return cadena;
  }
  window.google = {
    script: {
      get run() { return nuevaLlamada(); },
      url: { getLocation: function (cb) { setTimeout(function () { cb({ parameter: codigo ? { cliente: codigo } : {}, parameters: {}, hash: '' }); }, 0); } },
      history: { push: function () {}, replace: function () {}, setChangeHandler: function () {} },
      host: { close: function () {}, setHeight: function () {}, setWidth: function () {}, editor: { focus: function () {} } }
    }
  };

  // ---- Diseño de la app: se usa la copia guardada (arranque rápido) y se actualiza en segundo plano.
  var CABEZA = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<meta name="theme-color" content="#0d0f14"><meta name="apple-mobile-web-app-capable" content="yes">' +
    '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' +
    '<meta name="apple-mobile-web-app-title" content="RP Coach"><link rel="manifest" href="manifest.webmanifest">' +
    '<link rel="apple-touch-icon" href="icono-180.png"><link rel="icon" href="icono-192.png"><title>RP Coach</title>' +
    '<style>body{padding-top:env(safe-area-inset-top);}</style>';

  // Pone el diseño en esta página sin recargarla (así se conserva el sustituto de google.script).
  function mostrar(html) {
    var doc = new DOMParser().parseFromString(String(html), 'text/html');
    Array.prototype.forEach.call(doc.querySelectorAll('base'), function (b) { b.remove(); });
    document.head.innerHTML = CABEZA + doc.head.innerHTML;
    Array.prototype.forEach.call(doc.body.attributes, function (a) { document.body.setAttribute(a.name, a.value); });
    document.body.innerHTML = doc.body.innerHTML;
    // Los <script> metidos con innerHTML no se ejecutan: se recrean en orden.
    Array.prototype.forEach.call(document.body.querySelectorAll('script'), function (viejo) {
      var s = document.createElement('script');
      Array.prototype.forEach.call(viejo.attributes, function (a) { s.setAttribute(a.name, a.value); });
      s.text = viejo.text;
      viejo.parentNode.replaceChild(s, viejo);
    });
  }

  function texto(t, conBoton) {
    var p = document.getElementById('arranqueTexto');
    if (!p) return;
    p.textContent = t;
    if (conBoton && !document.getElementById('reintentar')) {
      var b = document.createElement('button');
      b.id = 'reintentar'; b.textContent = 'Reintentar';
      b.onclick = function () { location.reload(); };
      p.parentNode.appendChild(b);
    }
  }

  if (!codigo) {
    texto('Abre el enlace personal que te ha enviado tu entrenador para activar la app en este móvil.');
    return;
  }

  var copia = null;
  try { copia = localStorage.getItem(CLAVE_UI); } catch (e) {}
  var nueva = fetch(API + '?interfaz=1&t=' + Date.now(), { redirect: 'follow', cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(); return r.text(); })
    .then(function (html) {
      if (html.indexOf('<html') < 0 || html.indexOf('google.script.run') < 0) throw new Error();
      try { localStorage.setItem(CLAVE_UI, html); } catch (e) {}
      return html;
    });

  if (copia) {
    mostrar(copia);           // la versión nueva, si la hay, se verá en la próxima apertura
    nueva.catch(function () {});
  } else {
    nueva.then(mostrar, function () { texto('No se pudo abrir la app. Revisa tu conexión a internet.', true); });
  }
})();
