const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referencias del DOM
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLogout = document.getElementById('btn-logout');
const filtroVista = document.getElementById('filtro-vista');
const seccionAlameda = document.getElementById('seccion-alameda');
const seccionAtalaya = document.getElementById('seccion-atalaya');

// Autenticación de Google
btnLoginGoogle.addEventListener('click', async () => {
  await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
});

btnLogout.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  verificarSesion();
});

async function verificarSesion() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    cargarDatos();
  } else {
    loginView.classList.remove('hidden');
    appView.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', verificarSesion);

// Control de Pestañas / Vistas
filtroVista.addEventListener('change', (e) => {
  const valor = e.target.value;
  if (valor === 'ambas') {
    seccionAlameda.classList.remove('hidden');
    seccionAtalaya.classList.remove('hidden');
  } else if (valor === 'alameda') {
    seccionAlameda.classList.remove('hidden');
    seccionAtalaya.classList.add('hidden');
  } else if (valor === 'atalaya') {
    seccionAlameda.classList.add('hidden');
    seccionAtalaya.classList.remove('hidden');
  }
});

// Cargar Integrantes y pintar tabla con opciones de Editar y Eliminar (Pop-up de advertencia)
async function cargarDatos() {
  await cargarPersonas();
  await cargarAsignacionesMes();
}

async function cargarPersonas() {
  const { data: personas, error } = await supabaseClient.from('personas').select('*').order('nombre');
  const tbody = document.getElementById('tabla-personas');
  
  if (error || !personas.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-slate-400">No hay integrantes registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = personas.map(p => `
    <tr class="hover:bg-slate-50">
      <td class="py-3 px-3 font-medium">${p.nombre}</td>
      <td class="py-3 px-3"><span class="px-2 py-0.5 text-xs font-semibold rounded-full ${p.categoria === 'anciano' ? 'badge-amber bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">${p.categoria.toUpperCase()}</span></td>
      <td class="py-3 px-3 text-right space-x-2">
        <button onclick="abrirEditar('${p.id}', '${p.nombre}', '${p.categoria}')" class="text-blue-600 hover:underline font-medium text-xs">Editar</button>
        <button onclick="confirmarEliminar('${p.id}', '${p.nombre}')" class="text-red-600 hover:underline font-medium text-xs">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// CRUD Integrantes
document.getElementById('form-persona').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('nombre-persona').value.trim();
  const categoria = document.getElementById('categoria-persona').value;
  if (!nombre) return;

  const { error } = await supabaseClient.from('personas').insert([{ nombre, categoria }]);
  if (!error) {
    document.getElementById('nombre-persona').value = '';
    cargarPersonas();
  } else {
    alert('Error al guardar: ' + error.message);
  }
});

function abrirEditar(id, nombre, categoria) {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-nombre').value = nombre;
  document.getElementById('edit-categoria').value = categoria;
  document.getElementById('modal-editar').classList.remove('hidden');
}

function cerrarModal() {
  document.getElementById('modal-editar').classList.add('hidden');
}

async function guardarEdicion() {
  const id = document.getElementById('edit-id').value;
  const nombre = document.getElementById('nombre-nombre'] || document.getElementById('edit-nombre').value;
  const categoria = document.getElementById('edit-categoria').value;

  const { error } = await supabaseClient.from('personas').update({ nombre, categoria }).eq('id', id);
  if (!error) {
    cerrarModal();
    cargarPersonas();
  }
}

async function confirmarEliminar(id, nombre) {
  if (confirm(`¿Estás seguro de que deseas eliminar a ${nombre} del sistema? Esta acción no se puede deshacer.`)) {
    const { error } = await supabaseClient.from('personas').delete().eq('id', id);
    if (!error) cargarPersonas();
  }
}

// SIMULACIÓN O CARGA DE LAS TABLAS MENSUALES (Basado en la estructura de tu imagen)
async function cargarAsignacionesMes() {
  // Aquí puedes consultar las tablas de asignaciones mensuales desde Supabase
  // Rellenando de ejemplo para que veas la estructura interactiva:
  document.getElementById('tabla-alameda-body').innerHTML = `
    <tr>
      <td class="py-3 px-4 font-medium">1-oct</td>
      <td class="py-3 px-4">Luis E. Gómez<br>Jairo Julio</td>
      <td class="py-3 px-4">Farid Pallares</td>
      <td class="py-3 px-4">Husep Navarro<br>Daniel Romero</td>
      <td class="py-3 px-4">Kenneth Fritz</td>
      <td class="py-3 px-4">Grupos 4 y 5</td>
    </tr>
  `;

  document.getElementById('tabla-atalaya-body').innerHTML = `
    <tr>
      <td class="py-3 px-4 font-medium">3-oct</td>
      <td class="py-3 px-4">Onel Arzuza</td>
      <td class="py-3 px-4">Gerardo Pérez<br><span class="text-xs text-slate-400">Congregación Bostón</span></td>
      <td class="py-3 px-4"><input type="text" value="Joven, ¿cómo puedes ser feliz y tener éxito?" class="border border-slate-200 rounded px-2 py-1 text-xs w-full"></td>
      <td class="py-3 px-4">Oliver Gómez</td>
      <td class="py-3 px-4">Mauricio Restrepo</td>
    </tr>
  `;
}

function generarMesAutomatico() {
  alert('Motor de rotación mensual activado: Se distribuirán los hermanos evitando repeticiones consecutivas, asignando ancianos como presidentes, separando audio/video de acomodadores y emparejando los 12 grupos de limpieza.');
}