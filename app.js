// Referencias a los elementos del HTML
const formPersona = document.getElementById('form-persona');
const nombreInput = document.getElementById('nombre-persona');
const categoriaSelect = document.getElementById('categoria-persona');
const tablaPersonas = document.getElementById('tabla-personas');

// Cargar la lista de personas al iniciar la página
document.addEventListener('DOMContentLoaded', cargarPersonas);

// Función 1: Obtener personas desde Supabase y pintarlas en la tabla
async function cargarPersonas() {
  const { data: personas, error } = await supabaseClient
    .from('personas')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error al cargar personas:', error.message);
    tablaPersonas.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-red-500">Error al conectar con Supabase.</td></tr>`;
    return;
  }

  if (personas.length === 0) {
    tablaPersonas.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-slate-400">No hay integrantes registrados aún.</td></tr>`;
    return;
  }

  // Generar HTML dinámico
  tablaPersonas.innerHTML = personas.map(p => `
    <tr class="hover:bg-slate-50">
      <td class="py-3 px-3 font-medium text-slate-800">${p.nombre}</td>
      <td class="py-3 px-3">
        <span class="px-2 py-0.5 text-xs font-semibold rounded-full ${
          p.categoria === 'anciano' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
        }">
          ${p.categoria.toUpperCase()}
        </span>
      </td>
      <td class="py-3 px-3">
        <span class="text-xs ${p.activo ? 'text-emerald-600 font-semibold' : 'text-slate-400'}">
          ${p.activo ? '● Activo' : '○ Inactivo'}
        </span>
      </td>
    </tr>
  `).join('');
}

// Función 2: Guardar un nuevo integrante en Supabase
formPersona.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = nombreInput.value.trim();
  const categoria = categoriaSelect.value;

  if (!nombre) return;

  const { error } = await supabaseClient
    .from('personas')
    .insert([{ nombre, categoria, activo: true }]);

  if (error) {
    alert('Error al guardar la persona: ' + error.message);
  } else {
    nombreInput.value = ''; // Limpiar el formulario
    cargarPersonas(); // Recargar la tabla inmediatamente
  }
});