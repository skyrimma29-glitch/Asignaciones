// =====================================================================
//  Sistema de Asignaciones · Congregación Alameda
// =====================================================================
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ROLES = {
  acomodador:   'Acomodador',
  microfonista: 'Microfonista',
  audio_video:  'Audio y Video',
  plataforma:   'Plataforma',
  lector:       'Lector',
  oracion:      'Oración final'
};
const ROLES_POR_DEFECTO = ['acomodador', 'microfonista', 'plataforma', 'lector', 'oracion'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
// 12 grupos de limpieza repartidos en parejas rotativas
const PARES_LIMPIEZA = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]];

let personas = [];
let programa = null;          // { mes: 'AAAA-MM', datos: {...} }
let usuarioEmail = null;
let sesionIniciada = false;
let timerGuardado = null;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const puedeRol = (p, rol) => rol === 'presidente' ? p.categoria === 'anciano' : p.roles.includes(rol);

// ---------------------------------------------------------------------
//  Utilidades de interfaz
// ---------------------------------------------------------------------
function aviso(msg, esError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `no-print fixed bottom-4 right-4 max-w-sm px-4 py-3 rounded-xl shadow-lg text-sm text-white z-50 ${esError ? 'bg-red-600' : 'bg-slate-900'}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), esError ? 6000 : 3000);
}

const abrirModal  = id => $(id).classList.remove('hidden');
const cerrarModal = id => $(id).classList.add('hidden');
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { cerrarModal('modal-editar'); $('confirmar-cancelar').click(); }
});

// Ventana de advertencia que devuelve true/false
function confirmar({ titulo, mensaje, boton = 'Confirmar' }) {
  return new Promise(resolve => {
    $('confirmar-titulo').textContent = titulo;
    $('confirmar-mensaje').textContent = mensaje;
    $('confirmar-ok').textContent = boton;
    abrirModal('modal-confirmar');
    const fin = r => {
      cerrarModal('modal-confirmar');
      $('confirmar-ok').onclick = null;
      $('confirmar-cancelar').onclick = null;
      resolve(r);
    };
    $('confirmar-ok').onclick = () => fin(true);
    $('confirmar-cancelar').onclick = () => fin(false);
  });
}

function mostrarVista(vista) {
  $('login-view').classList.toggle('hidden', vista === 'app');
  $('app-view').classList.toggle('hidden', vista !== 'app');
  $('bloque-cargando').classList.add('hidden');
  $('bloque-login').classList.toggle('hidden', vista !== 'login');
  $('bloque-no-autorizado').classList.toggle('hidden', vista !== 'noauth');
}

// ---------------------------------------------------------------------
//  Autenticación con Google + lista blanca
// ---------------------------------------------------------------------
$('btn-login-google').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) aviso('No se pudo iniciar sesión: ' + error.message, true);
});

const cerrarSesion = () => supabaseClient.auth.signOut();
$('btn-logout').addEventListener('click', cerrarSesion);
$('btn-logout-noauth').addEventListener('click', cerrarSesion);

// setTimeout evita bloqueos al llamar a Supabase dentro del listener
supabaseClient.auth.onAuthStateChange((_evento, session) => {
  setTimeout(() => manejarSesion(session), 0);
});

async function manejarSesion(session) {
  if (!session) { sesionIniciada = false; mostrarVista('login'); return; }
  if (sesionIniciada) return;

  // La política RLS solo deja ver la fila del propio correo
  const { data, error } = await supabaseClient.from('usuarios_autorizados').select('email').limit(1);
  if (error || !data || data.length === 0) {
    $('correo-no-autorizado').textContent = session.user.email;
    mostrarVista('noauth');
    return;
  }
  sesionIniciada = true;
  usuarioEmail = session.user.email;
  $('usuario-actual').textContent = usuarioEmail;
  mostrarVista('app');
  await iniciarApp();
}

async function iniciarApp() {
  const opcionesDias = DIAS.map((d, i) => `<option value="${i}">${d}</option>`).join('');
  $('dia-semana').innerHTML = opcionesDias;
  $('dia-fin').innerHTML = opcionesDias;
  $('dia-semana').value = '4';   // Jueves
  $('dia-fin').value = '6';      // Sábado

  if (!$('mes').value) {
    const hoy = new Date();
    const sig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    $('mes').value = claveMes(sig);
  }
  pintarCheckRoles('roles-nuevo', ROLES_POR_DEFECTO);
  await cargarPersonas();
  await cargarPrograma();
}

// ---------------------------------------------------------------------
//  Selector de vistas
// ---------------------------------------------------------------------
$('filtro-vista').addEventListener('change', e => {
  const v = e.target.value;
  $('seccion-alameda').classList.toggle('hidden', v === 'atalaya');
  $('seccion-atalaya').classList.toggle('hidden', v === 'alameda');
});

// ---------------------------------------------------------------------
//  Directorio de integrantes (CRUD)
// ---------------------------------------------------------------------
async function cargarPersonas() {
  const { data, error } = await supabaseClient.from('personas').select('*').order('nombre');
  if (error) {
    aviso('Error al cargar integrantes: ' + error.message, true);
    personas = [];
  } else {
    personas = (data || []).map(p => ({
      ...p,
      roles: Array.isArray(p.roles) ? p.roles : [...ROLES_POR_DEFECTO],
      activo: p.activo !== false
    }));
  }
  pintarPersonas();
}

function pintarPersonas() {
  const tbody = $('tabla-personas');
  const ancianos = personas.filter(p => p.categoria === 'anciano').length;
  $('resumen-personas').textContent =
    `${personas.length} integrantes · ${ancianos} ancianos · ${personas.length - ancianos} publicadores`;

  if (personas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">No hay integrantes registrados.</td></tr>`;
    return;
  }
  tbody.innerHTML = personas.map(p => `
    <tr class="hover:bg-slate-50 ${p.activo ? '' : 'opacity-50'}">
      <td class="py-3 px-3 font-medium">${esc(p.nombre)}${p.activo ? '' : ' <span class="text-xs text-slate-400">(inactivo)</span>'}</td>
      <td class="py-3 px-3">
        <span class="px-2 py-0.5 text-xs font-semibold rounded-full ${p.categoria === 'anciano' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
          ${p.categoria === 'anciano' ? 'ANCIANO' : 'PUBLICADOR'}
        </span>
      </td>
      <td class="py-3 px-3">
        <div class="flex flex-wrap gap-1">
          ${p.categoria === 'anciano' ? '<span class="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-700 border border-amber-200">Presidente</span>' : ''}
          ${p.roles.map(r => `<span class="px-1.5 py-0.5 text-[10px] rounded border ${r === 'audio_video' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-blue-50 text-blue-700 border-blue-200'}">${esc(ROLES[r] || r)}</span>`).join('')}
        </div>
      </td>
      <td class="py-3 px-3 text-right whitespace-nowrap space-x-3">
        <button data-accion="editar" data-id="${esc(p.id)}" class="text-blue-600 hover:underline font-medium text-xs">Editar</button>
        <button data-accion="eliminar" data-id="${esc(p.id)}" class="text-red-600 hover:underline font-medium text-xs">Eliminar</button>
      </td>
    </tr>`).join('');
}

// Delegación de eventos (funciona con nombres que tengan tildes o apóstrofes)
$('tabla-personas').addEventListener('click', e => {
  const btn = e.target.closest('button[data-accion]');
  if (!btn) return;
  const p = personas.find(x => String(x.id) === btn.dataset.id);
  if (!p) return;
  if (btn.dataset.accion === 'editar') abrirEditar(p);
  else eliminarPersona(p);
});

function pintarCheckRoles(contenedorId, seleccionados) {
  $(contenedorId).innerHTML = Object.entries(ROLES).map(([k, v]) => `
    <label class="inline-flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer">
      <input type="checkbox" value="${k}" ${seleccionados.includes(k) ? 'checked' : ''} class="accent-blue-600"> ${v}
    </label>`).join('');
}
const leerRoles = id => [...$(id).querySelectorAll('input:checked')].map(i => i.value);

// Regla: Audio y Video y Acomodador son excluyentes
['roles-nuevo', 'roles-editar'].forEach(id => $(id).addEventListener('change', e => {
  if (!e.target.checked) return;
  const v = e.target.value;
  const opuesto = v === 'acomodador' ? 'audio_video' : v === 'audio_video' ? 'acomodador' : null;
  const casilla = opuesto && $(id).querySelector(`input[value="${opuesto}"]`);
  if (casilla && casilla.checked) {
    casilla.checked = false;
    aviso(`Audio y Video y Acomodadores son equipos separados: se desmarcó "${ROLES[opuesto]}".`);
  }
}));

$('form-persona').addEventListener('submit', async e => {
  e.preventDefault();
  const nombre = $('nombre-persona').value.trim();
  const categoria = $('categoria-persona').value;
  const roles = leerRoles('roles-nuevo');
  if (!nombre) return;
  if (personas.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
    return aviso('Ya existe un integrante con ese nombre.', true);
  }
  const { error } = await supabaseClient.from('personas').insert([{ nombre, categoria, roles, activo: true }]);
  if (error) return aviso('Error al guardar: ' + error.message, true);
  $('nombre-persona').value = '';
  pintarCheckRoles('roles-nuevo', ROLES_POR_DEFECTO);
  aviso(`${nombre} fue agregado.`);
  await cargarPersonas();
  renderPrograma();
});

function abrirEditar(p) {
  $('edit-id').value = p.id;
  $('edit-nombre').value = p.nombre;
  $('edit-categoria').value = p.categoria;
  $('edit-activo').checked = p.activo;
  pintarCheckRoles('roles-editar', p.roles);
  abrirModal('modal-editar');
}
$('btn-cancelar-edicion').addEventListener('click', () => cerrarModal('modal-editar'));

$('btn-guardar-edicion').addEventListener('click', async () => {
  const id = $('edit-id').value;
  const nombre = $('edit-nombre').value.trim();
  const categoria = $('edit-categoria').value;
  const roles = leerRoles('roles-editar');
  const activo = $('edit-activo').checked;
  if (!nombre) return aviso('El nombre no puede estar vacío.', true);

  const original = personas.find(p => String(p.id) === id);
  if (original && original.categoria === 'anciano' && categoria !== 'anciano') {
    const ok = await confirmar({
      titulo: 'Cambiar categoría',
      mensaje: `${nombre} dejará de ser anciano y ya no podrá ser asignado como presidente. ¿Continuar?`,
      boton: 'Sí, cambiar'
    });
    if (!ok) return;
  }

  const { data, error } = await supabaseClient.from('personas')
    .update({ nombre, categoria, roles, activo }).eq('id', id).select();
  if (error) return aviso('Error al actualizar: ' + error.message, true);
  if (!data || data.length === 0) {
    return aviso('No se guardó el cambio. Revisa las políticas RLS de la tabla "personas" (ejecuta schema.sql).', true);
  }
  cerrarModal('modal-editar');
  aviso('Cambios guardados.');
  await cargarPersonas();
  renderPrograma();
});

async function eliminarPersona(p) {
  const ok = await confirmar({
    titulo: 'Eliminar integrante',
    mensaje: `¿Seguro que deseas eliminar a ${p.nombre} del sistema? Esta acción no se puede deshacer. Si solo estará ausente un tiempo, mejor edítalo y desmarca "Activo".`,
    boton: 'Sí, eliminar'
  });
  if (!ok) return;
  const { data, error } = await supabaseClient.from('personas').delete().eq('id', p.id).select();
  if (error) return aviso('Error al eliminar: ' + error.message, true);
  if (!data || data.length === 0) {
    return aviso('No se eliminó. Revisa las políticas RLS de la tabla "personas" (ejecuta schema.sql).', true);
  }
  aviso(`${p.nombre} fue eliminado.`);
  await cargarPersonas();
  renderPrograma();
}

// ---------------------------------------------------------------------
//  Fechas
// ---------------------------------------------------------------------
const claveMes = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const iso = d => `${claveMes(d)}-${String(d.getDate()).padStart(2, '0')}`;
const aFecha = s => new Date(s + 'T12:00:00');
const diaDe = s => aFecha(s).getDay();
const fechaCorta = s => { const d = aFecha(s); return `${d.getDate()}-${MESES_CORTOS[d.getMonth()]}`; };
const nombreMes = mes => { if (!mes) return ''; const [y, m] = mes.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };

function mesAnterior(mes) {
  const [y, m] = mes.split('-').map(Number);
  return claveMes(new Date(y, m - 2, 1));
}

function fechasDelMes(mes, dia) {
  const [y, m] = mes.split('-').map(Number);
  const out = [];
  const d = new Date(y, m - 1, 1, 12);
  while (d.getMonth() === m - 1) {
    if (d.getDay() === dia) out.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function inicioSemana(s) {           // semana de lunes a domingo
  const d = aFecha(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

// ---------------------------------------------------------------------
//  Motor de rotación con restricciones
// ---------------------------------------------------------------------
function idsDelPrograma(datos) {
  const ids = [];
  (datos.alameda || []).forEach(r => ids.push(...r.acomodadores, r.microfonista, ...r.audioVideo));
  (datos.semanas || []).forEach(s => ids.push(s.plataforma));
  (datos.atalaya || []).forEach(r => ids.push(r.presidente, r.lector, r.oracion));
  return ids.filter(Boolean);
}

function generarPrograma(mes, diaEntre, diaFin, previo) {
  const activos = personas.filter(p => p.activo);
  const carga = {};   // cuántas veces participa (más bajo = más prioridad)
  const ultima = {};  // índice de la última reunión en que participó
  activos.forEach(p => { carga[p.id] = 0; });

  // Quien participó el mes pasado arranca con algo de carga,
  // así los que quedaron libres tienen prioridad este mes.
  if (previo) idsDelPrograma(previo).forEach(id => { if (id in carga) carga[id] += 0.5; });

  const reuniones = [...fechasDelMes(mes, diaEntre), ...fechasDelMes(mes, diaFin)].sort();
  const porSemana = new Map();
  reuniones.forEach(f => {
    const k = inicioSemana(f);
    if (!porSemana.has(k)) porSemana.set(k, []);
    porSemana.get(k).push(f);
  });

  function elegir(rol, usados, idx) {
    let cands = activos.filter(p => puedeRol(p, rol) && !usados.has(p.id));
    // Evitar que repita en la reunión inmediatamente anterior
    const sinSeguido = cands.filter(p => ultima[p.id] === undefined || idx - ultima[p.id] > 1);
    if (sinSeguido.length) cands = sinSeguido;
    if (!cands.length) return null;
    // Los ancianos pueden hacer otras tareas, pero se prefiere a los publicadores
    const puntaje = p => carga[p.id]
      + (rol !== 'presidente' && p.categoria === 'anciano' ? 0.75 : 0)
      + Math.random() * 0.6;
    const elegido = cands.map(p => [p, puntaje(p)]).sort((a, b) => a[1] - b[1])[0][0];
    carga[elegido.id] += 1;
    ultima[elegido.id] = idx;
    usados.add(elegido.id);
    return elegido.id;
  }

  const inicioPar = previo && Number.isInteger(previo.siguientePar) ? previo.siguientePar : 0;
  const semanas = [], alameda = [], atalaya = [];
  let numOrador = 1;

  [...porSemana.values()].forEach((fechas, s) => {
    const plataforma = elegir('plataforma', new Set(), reuniones.indexOf(fechas[0]));
    semanas.push({
      plataforma,
      limpieza: [...PARES_LIMPIEZA[(inicioPar + s) % PARES_LIMPIEZA.length]]
    });

    fechas.forEach(f => {
      const idx = reuniones.indexOf(f);
      const usados = new Set(plataforma ? [plataforma] : []);
      const esFinDeSemana = diaDe(f) === diaFin;

      // 1) Presidente (solo ancianos) primero, porque es el grupo más pequeño
      const presidente = esFinDeSemana ? elegir('presidente', usados, idx) : null;
      // 2) Audio y Video (equipo separado de acomodadores)
      const audioVideo = [elegir('audio_video', usados, idx), elegir('audio_video', usados, idx)];
      // 3) Acomodadores y microfonista
      const acomodadores = [elegir('acomodador', usados, idx), elegir('acomodador', usados, idx)];
      const microfonista = elegir('microfonista', usados, idx);

      alameda.push({ fecha: f, semana: s, acomodadores, microfonista, audioVideo });

      if (esFinDeSemana) {
        atalaya.push({
          fecha: f,
          presidente,
          orador: `Orador #${numOrador++}`,
          congregacion: '',
          discurso: '',
          lector: elegir('lector', usados, idx),
          oracion: elegir('oracion', usados, idx)
        });
      }
    });
  });

  return {
    diaEntreSemana: diaEntre,
    diaFinSemana: diaFin,
    semanas, alameda, atalaya,
    siguientePar: (inicioPar + semanas.length) % PARES_LIMPIEZA.length
  };
}

// ---------------------------------------------------------------------
//  Cargar / generar / guardar programa
// ---------------------------------------------------------------------
async function obtenerPrograma(mes) {
  const { data, error } = await supabaseClient.from('programas').select('*').eq('mes', mes).maybeSingle();
  if (error) { aviso('Error al cargar el programa: ' + error.message, true); return null; }
  return data;
}

async function cargarPrograma() {
  const mes = $('mes').value;
  $('titulo-mes').textContent = nombreMes(mes);
  const fila = mes ? await obtenerPrograma(mes) : null;
  programa = fila ? { mes, datos: fila.datos } : null;
  if (programa) {
    $('dia-semana').value = String(programa.datos.diaEntreSemana);
    $('dia-fin').value = String(programa.datos.diaFinSemana);
  }
  estadoGuardado(fila ? 'Guardado ✓' : '');
  renderPrograma();
}
$('mes').addEventListener('change', cargarPrograma);

$('btn-generar').addEventListener('click', async () => {
  const mes = $('mes').value;
  if (!mes) return aviso('Selecciona un mes.', true);
  const diaEntre = Number($('dia-semana').value);
  const diaFin = Number($('dia-fin').value);
  if (diaEntre === diaFin) return aviso('Los dos días de reunión deben ser distintos.', true);

  const activos = personas.filter(p => p.activo);
  if (!activos.some(p => p.categoria === 'anciano')) return aviso('Registra al menos un anciano activo para asignar presidentes.', true);
  if (!activos.some(p => p.roles.includes('audio_video'))) aviso('Nadie tiene habilitado "Audio y Video": esa columna quedará vacía.', true);

  let textosPrevios = {};
  if (programa) {
    const ok = await confirmar({
      titulo: 'Regenerar programa',
      mensaje: `Ya existe un programa para ${nombreMes(mes)}. Se reemplazarán las asignaciones (incluidos cambios manuales). Los oradores y títulos de discursos ya escritos se conservan. ¿Continuar?`,
      boton: 'Sí, regenerar'
    });
    if (!ok) return;
    programa.datos.atalaya.forEach(r => { textosPrevios[r.fecha] = r; });
  }

  const previo = await obtenerPrograma(mesAnterior(mes));
  const datos = generarPrograma(mes, diaEntre, diaFin, previo ? previo.datos : null);
  datos.atalaya.forEach(r => {
    const t = textosPrevios[r.fecha];
    if (t) { r.orador = t.orador; r.congregacion = t.congregacion; r.discurso = t.discurso; }
  });

  programa = { mes, datos };
  renderPrograma();
  await guardarPrograma();
  aviso(`Programa de ${nombreMes(mes)} generado. Puedes ajustar cualquier casilla.`);
});

function estadoGuardado(texto) { $('estado-guardado').textContent = texto; }

function programarGuardado() {
  estadoGuardado('Guardando…');
  clearTimeout(timerGuardado);
  timerGuardado = setTimeout(guardarPrograma, 700);
}

async function guardarPrograma() {
  if (!programa) return;
  const { error } = await supabaseClient.from('programas').upsert({
    mes: programa.mes,
    datos: programa.datos,
    actualizado_en: new Date().toISOString(),
    actualizado_por: usuarioEmail
  });
  if (error) { estadoGuardado('Error al guardar'); aviso('Error al guardar el programa: ' + error.message, true); }
  else estadoGuardado('Guardado ✓');
}

$('btn-imprimir').addEventListener('click', () => window.print());

// ---------------------------------------------------------------------
//  Render de tablas editables
// ---------------------------------------------------------------------
function sel(rol, valor, ruta, fechas) {
  const v = valor == null ? '' : String(valor);
  const cands = personas.filter(p => p.activo && puedeRol(p, rol));
  let opts = '<option value="">—</option>' + cands.map(p =>
    `<option value="${esc(p.id)}"${String(p.id) === v ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('');
  if (v && !cands.some(p => String(p.id) === v)) {
    const p = personas.find(x => String(x.id) === v);
    opts += `<option value="${esc(v)}" selected>${p ? esc(p.nombre) + ' (no habilitado)' : '(eliminado)'}</option>`;
  }
  return `<select data-ruta="${ruta}" data-fechas="${fechas}">${opts}</select>`;
}

function selGrupo(valor, ruta) {
  let opts = '';
  for (let g = 1; g <= 12; g++) opts += `<option value="${g}"${g === valor ? ' selected' : ''}>${g}</option>`;
  return `<select class="grupo" data-ruta="${ruta}" data-num="1">${opts}</select>`;
}

function renderPrograma() {
  const bodyA = $('tabla-alameda-body');
  const bodyT = $('tabla-atalaya-body');

  if (!programa) {
    const vacio = `<tr><td colspan="6" class="py-8 text-center text-slate-400">No hay programa para ${esc(nombreMes($('mes').value))}. Usa “Generar mes”.</td></tr>`;
    bodyA.innerHTML = vacio;
    bodyT.innerHTML = vacio;
    $('aviso-conflictos').classList.add('hidden');
    return;
  }

  const d = programa.datos;
  let html = '';
  d.semanas.forEach((sem, s) => {
    const filas = d.alameda.map((r, i) => ({ r, i })).filter(x => x.r.semana === s);
    const fechasSemana = filas.map(x => x.r.fecha).join(' ');
    filas.forEach(({ r, i }, k) => {
      html += `<tr>
        <td class="font-medium whitespace-nowrap">${fechaCorta(r.fecha)}
          <div class="text-[10px] text-slate-400 no-print">${DIAS[diaDe(r.fecha)]}</div></td>
        <td class="celda"><div class="space-y-1">
          ${sel('acomodador', r.acomodadores[0], `alameda.${i}.acomodadores.0`, r.fecha)}
          ${sel('acomodador', r.acomodadores[1], `alameda.${i}.acomodadores.1`, r.fecha)}</div></td>
        <td class="celda">${sel('microfonista', r.microfonista, `alameda.${i}.microfonista`, r.fecha)}</td>
        <td class="celda"><div class="space-y-1">
          ${sel('audio_video', r.audioVideo[0], `alameda.${i}.audioVideo.0`, r.fecha)}
          ${sel('audio_video', r.audioVideo[1], `alameda.${i}.audioVideo.1`, r.fecha)}</div></td>
        ${k === 0 ? `
          <td class="celda" rowspan="${filas.length}">${sel('plataforma', sem.plataforma, `semanas.${s}.plataforma`, fechasSemana)}</td>
          <td class="celda whitespace-nowrap" rowspan="${filas.length}">Grupos
            ${selGrupo(sem.limpieza[0], `semanas.${s}.limpieza.0`)} y ${selGrupo(sem.limpieza[1], `semanas.${s}.limpieza.1`)}</td>` : ''}
      </tr>`;
    });
  });
  bodyA.innerHTML = html;

  bodyT.innerHTML = d.atalaya.length ? d.atalaya.map((r, i) => `
    <tr>
      <td class="font-medium whitespace-nowrap">${fechaCorta(r.fecha)}
        <div class="text-[10px] text-slate-400 no-print">${DIAS[diaDe(r.fecha)]}</div></td>
      <td class="celda">${sel('presidente', r.presidente, `atalaya.${i}.presidente`, r.fecha)}</td>
      <td class="celda"><div class="space-y-1">
        <input type="text" data-ruta="atalaya.${i}.orador" value="${esc(r.orador)}" placeholder="Nombre del orador">
        <input type="text" data-ruta="atalaya.${i}.congregacion" value="${esc(r.congregacion)}" placeholder="Congregación" class="text-slate-500"></div></td>
      <td class="celda"><textarea rows="2" data-ruta="atalaya.${i}.discurso" placeholder="Título del discurso público">${esc(r.discurso)}</textarea></td>
      <td class="celda">${sel('lector', r.lector, `atalaya.${i}.lector`, r.fecha)}</td>
      <td class="celda">${sel('oracion', r.oracion, `atalaya.${i}.oracion`, r.fecha)}</td>
    </tr>`).join('')
    : `<tr><td colspan="6" class="py-6 text-center text-slate-400">No hay reuniones de fin de semana en este mes.</td></tr>`;

  marcarConflictos();
}

// Escribe un valor dentro de programa.datos siguiendo una ruta tipo "alameda.3.acomodadores.0"
function asignarRuta(obj, ruta, valor) {
  const partes = ruta.split('.');
  let o = obj;
  for (let i = 0; i < partes.length - 1; i++) o = o[partes[i]];
  o[partes[partes.length - 1]] = valor;
}

document.addEventListener('change', e => {
  const el = e.target.closest('select[data-ruta]');
  if (!el || !programa) return;
  asignarRuta(programa.datos, el.dataset.ruta, el.dataset.num ? Number(el.value) : (el.value || null));
  marcarConflictos();
  programarGuardado();
});

document.addEventListener('input', e => {
  const el = e.target.closest('input[data-ruta], textarea[data-ruta]');
  if (!el || !programa) return;
  asignarRuta(programa.datos, el.dataset.ruta, el.value);
  programarGuardado();
});

// Marca en rojo a quien quede asignado dos veces en la misma reunión
function marcarConflictos() {
  const porFecha = {};
  document.querySelectorAll('select[data-fechas]').forEach(s => {
    s.classList.remove('conflicto');
    s.title = '';
    if (!s.value) return;
    s.dataset.fechas.split(' ').forEach(f => { (porFecha[f] = porFecha[f] || []).push(s); });
  });
  let hay = false;
  Object.values(porFecha).forEach(lista => {
    const cuenta = {};
    lista.forEach(s => { cuenta[s.value] = (cuenta[s.value] || 0) + 1; });
    lista.forEach(s => {
      if (cuenta[s.value] > 1) {
        s.classList.add('conflicto');
        s.title = 'Asignado más de una vez en la misma reunión';
        hay = true;
      }
    });
  });
  $('aviso-conflictos').classList.toggle('hidden', !hay);
}
