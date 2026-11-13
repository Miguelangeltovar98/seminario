/* ==========================================================
   Backlog Ágil · Lógica de la aplicación
   ----------------------------------------------------------
   CRUD de historias de usuario guardadas en localStorage:
     C - Create  → crearHistoria()
     R - Read    → obtenerHistorias()  + render()
     U - Update  → actualizarHistoria()
     D - Delete  → eliminarHistoria()

   Organización del archivo:
     1. Configuración y estado
     2. Persistencia (localStorage)
     3. Operaciones CRUD
     4. Validación
     5. Renderizado (dibujar en pantalla)
     6. Formulario y edición
     7. Eliminación con confirmación
     8. Utilidades
     9. Eventos e inicio
   ========================================================== */

'use strict';

/* ---------- 1. Configuración y estado ---------- */

const CLAVE_STORAGE = 'backlog-agil:historias';
const ORDEN_PRIORIDAD = { Alta: 0, Media: 1, Baja: 2 };
const PRIORIDADES = Object.keys(ORDEN_PRIORIDAD);
const ESTADOS = ['Por hacer', 'En progreso', 'Hecho'];
const PUNTOS_VALIDOS = [1, 2, 3, 5, 8, 13]; // escala Fibonacci usada en Scrum
const CAMPOS_OBLIGATORIOS = ['titulo', 'rol', 'accion', 'beneficio'];

let historias = [];       // copia en memoria de lo que hay en localStorage
let idEnEdicion = null;   // id de la historia que se edita (null = modo crear)
let idPorEliminar = null; // id esperando confirmación en el diálogo

const $ = (selector) => document.querySelector(selector);

const dom = {
  formulario: $('#formulario'),
  panelFormulario: $('.panel--formulario'),
  tituloFormulario: $('#titulo-formulario'),
  botonGuardar: $('#boton-guardar'),
  botonCancelar: $('#boton-cancelar'),
  lista: $('#lista-historias'),
  vacio: $('#estado-vacio'),
  sinResultados: $('#sin-resultados'),
  contador: $('#contador-resultados'),
  buscar: $('#buscar'),
  filtroEstado: $('#filtro-estado'),
  filtroPrioridad: $('#filtro-prioridad'),
  botonEjemplos: $('#boton-ejemplos'),
  dialogo: $('#dialogo-eliminar'),
  dialogoNombre: $('#dialogo-nombre'),
  dialogoCancelar: $('#dialogo-cancelar'),
  dialogoConfirmar: $('#dialogo-confirmar'),
  aviso: $('#aviso'),
};

// Datos de ejemplo para probar la app rápidamente (backlog de una tienda en línea)
const EJEMPLOS = [
  {
    titulo: 'Registro de usuarios',
    rol: 'cliente nuevo',
    accion: 'crear una cuenta con mi correo y una contraseña',
    beneficio: 'guardar mis datos y consultar mis pedidos',
    criterios:
      'Dado que estoy en el formulario de registro\n' +
      'Cuando ingreso un correo válido y una contraseña de al menos 8 caracteres\n' +
      'Entonces mi cuenta se crea y veo un mensaje de bienvenida\n\n' +
      'Dado que el correo ya está registrado\n' +
      'Cuando intento crear la cuenta\n' +
      'Entonces veo el mensaje "Este correo ya tiene una cuenta"',
    prioridad: 'Alta',
    puntos: 5,
    estado: 'En progreso',
    responsable: 'Laura',
  },
  {
    titulo: 'Carrito de compras',
    rol: 'cliente',
    accion: 'agregar productos al carrito',
    beneficio: 'pagarlos todos en una sola compra',
    criterios:
      'Dado que estoy viendo un producto con existencias\n' +
      'Cuando presiono "Agregar al carrito"\n' +
      'Entonces el contador del carrito aumenta en 1',
    prioridad: 'Alta',
    puntos: 8,
    estado: 'Por hacer',
    responsable: 'Andrés',
  },
  {
    titulo: 'Historial de pedidos',
    rol: 'cliente registrado',
    accion: 'ver la lista de mis pedidos anteriores',
    beneficio: 'repetir una compra fácilmente',
    criterios: '',
    prioridad: 'Media',
    puntos: 3,
    estado: 'Por hacer',
    responsable: '',
  },
  {
    titulo: 'Recuperar contraseña',
    rol: 'usuario',
    accion: 'restablecer mi contraseña desde un enlace en mi correo',
    beneficio: 'recuperar el acceso si la olvido',
    criterios:
      'Dado que olvidé mi contraseña\n' +
      'Cuando solicito el enlace de recuperación con mi correo\n' +
      'Entonces recibo un correo con un enlace válido por 30 minutos',
    prioridad: 'Media',
    puntos: 2,
    estado: 'Hecho',
    responsable: 'Sofía',
  },
  {
    titulo: 'Filtro por categoría',
    rol: 'cliente',
    accion: 'filtrar los productos por categoría',
    beneficio: 'encontrar más rápido lo que busco',
    criterios: '',
    prioridad: 'Baja',
    puntos: 2,
    estado: 'Por hacer',
    responsable: '',
  },
];

/* ---------- 2. Persistencia (localStorage) ---------- */

// Lee las historias guardadas. Si no hay nada o el JSON está dañado, devuelve [].
function leerStorage() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_STORAGE));
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    console.warn('No se pudieron leer los datos guardados:', error);
    return [];
  }
}

// Guarda la lista completa en localStorage como texto JSON.
function escribirStorage() {
  try {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(historias));
  } catch (error) {
    console.error('No se pudo guardar:', error);
    mostrarAviso('No se pudieron guardar los cambios en este navegador');
  }
}

/* ---------- 3. Operaciones CRUD ---------- */

// CREATE: agrega una historia nueva con id y fechas.
function crearHistoria(datos) {
  const ahora = new Date().toISOString();
  const nueva = { id: generarId(), ...datos, creada: ahora, actualizada: ahora };
  historias.push(nueva);
  escribirStorage();
  return nueva;
}

// READ: devuelve las historias que cumplen la búsqueda y los filtros,
// ordenadas por prioridad (Alta → Baja) y luego por las más recientes.
function obtenerHistorias({ texto = '', estado = '', prioridad = '' } = {}) {
  const busqueda = normalizar(texto);

  return historias
    .filter((h) => !estado || h.estado === estado)
    .filter((h) => !prioridad || h.prioridad === prioridad)
    .filter((h) => {
      if (!busqueda) return true;
      const contenido = `${h.titulo} ${h.rol} ${h.accion} ${h.beneficio} ${h.responsable}`;
      return normalizar(contenido).includes(busqueda);
    })
    .sort(
      (a, b) =>
        ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] ||
        b.creada.localeCompare(a.creada)
    );
}

function buscarPorId(id) {
  return historias.find((h) => h.id === id);
}

// UPDATE: reemplaza los datos de una historia existente y actualiza su fecha.
function actualizarHistoria(id, datos) {
  const indice = historias.findIndex((h) => h.id === id);
  if (indice === -1) return null;

  historias[indice] = { ...historias[indice], ...datos, actualizada: new Date().toISOString() };
  escribirStorage();
  return historias[indice];
}

// DELETE: quita la historia de la lista. Devuelve true si se eliminó.
function eliminarHistoria(id) {
  const totalAntes = historias.length;
  historias = historias.filter((h) => h.id !== id);
  escribirStorage();
  return historias.length < totalAntes;
}

/* ---------- 4. Validación ---------- */

// Devuelve un objeto { campo: 'mensaje de error' }. Si está vacío, los datos son válidos.
function validar(datos) {
  const errores = {};

  if (!datos.titulo) {
    errores.titulo = 'Escribe un título.';
  } else if (datos.titulo.length < 3) {
    errores.titulo = 'El título debe tener al menos 3 caracteres.';
  } else if (
    historias.some((h) => h.id !== idEnEdicion && normalizar(h.titulo) === normalizar(datos.titulo))
  ) {
    errores.titulo = 'Ya existe una historia con ese título.';
  }

  if (!datos.rol) errores.rol = 'Indica quién es el usuario (ej: cliente).';
  if (!datos.accion) errores.accion = 'Describe qué quiere hacer el usuario.';
  if (!datos.beneficio) errores.beneficio = 'Explica para qué lo necesita.';

  return errores;
}

/* ---------- 5. Renderizado ---------- */

// Vuelve a dibujar la lista y las estadísticas a partir del estado actual.
function render() {
  const visibles = obtenerHistorias({
    texto: dom.buscar.value,
    estado: dom.filtroEstado.value,
    prioridad: dom.filtroPrioridad.value,
  });

  dom.lista.replaceChildren(...visibles.map(crearTarjeta));
  dom.vacio.hidden = historias.length > 0;
  dom.sinResultados.hidden = historias.length === 0 || visibles.length > 0;
  dom.contador.textContent = historias.length
    ? `Mostrando ${visibles.length} de ${historias.length}`
    : '';

  renderEstadisticas();
}

function renderEstadisticas() {
  const contarPorEstado = (estado) => historias.filter((h) => h.estado === estado).length;

  $('#stat-total').textContent = historias.length;
  $('#stat-puntos').textContent = historias.reduce((suma, h) => suma + Number(h.puntos || 0), 0);
  $('#stat-por-hacer').textContent = contarPorEstado('Por hacer');
  $('#stat-en-progreso').textContent = contarPorEstado('En progreso');
  $('#stat-hecho').textContent = contarPorEstado('Hecho');
}

// Construye la tarjeta de una historia. Se usa textContent (nunca innerHTML)
// para que el texto que escribe el usuario no pueda ejecutar código (XSS).
function crearTarjeta(h) {
  const tarjeta = crearElemento('li', `tarjeta tarjeta--${h.prioridad}`);
  tarjeta.dataset.id = h.id;

  const cabecera = crearElemento('div', 'tarjeta__cabecera');
  cabecera.append(
    crearElemento('h3', 'tarjeta__titulo', h.titulo),
    crearElemento('span', `etiqueta etiqueta--${h.prioridad}`, `Prioridad ${h.prioridad.toLowerCase()}`)
  );

  const historia = crearElemento('p', 'tarjeta__historia');
  historia.append(
    'Como ', crearElemento('strong', '', h.rol),
    ', quiero ', crearElemento('strong', '', h.accion),
    ', para ', crearElemento('strong', '', h.beneficio), '.'
  );

  tarjeta.append(cabecera, historia);

  if (h.criterios) {
    const criterios = crearElemento('details', 'tarjeta__criterios');
    criterios.append(
      crearElemento('summary', '', 'Criterios de aceptación'),
      crearElemento('pre', '', h.criterios)
    );
    tarjeta.append(criterios);
  }

  const meta = crearElemento('div', 'tarjeta__meta');
  meta.append(
    crearElemento('span', `etiqueta ${claseEstado(h.estado)}`, h.estado),
    crearElemento('span', 'puntos', `${h.puntos} pts`)
  );
  if (h.responsable) meta.append(crearElemento('span', '', `Responsable: ${h.responsable}`));
  meta.append(crearElemento('span', '', `Actualizada: ${formatearFecha(h.actualizada)}`));

  const acciones = crearElemento('div', 'tarjeta__acciones');
  acciones.append(
    crearBoton('Editar', 'editar', 'boton boton--secundario boton--pequeno', `Editar ${h.titulo}`),
    crearBoton('Eliminar', 'eliminar', 'boton boton--secundario boton--pequeno boton--texto-peligro', `Eliminar ${h.titulo}`)
  );

  const pie = crearElemento('div', 'tarjeta__pie');
  pie.append(meta, acciones);
  tarjeta.append(pie);

  return tarjeta;
}

/* ---------- 6. Formulario y edición ---------- */

function leerFormulario() {
  const valor = (id) => document.getElementById(id).value.trim();
  const prioridad = valor('prioridad');
  const estado = valor('estado');
  const puntos = Number(valor('puntos'));

  return {
    titulo: valor('titulo'),
    rol: valor('rol'),
    accion: valor('accion'),
    beneficio: valor('beneficio'),
    criterios: valor('criterios'),
    responsable: valor('responsable'),
    // Solo se aceptan valores conocidos, aunque alguien modifique el HTML
    prioridad: PRIORIDADES.includes(prioridad) ? prioridad : 'Media',
    estado: ESTADOS.includes(estado) ? estado : 'Por hacer',
    puntos: PUNTOS_VALIDOS.includes(puntos) ? puntos : 3,
  };
}

function llenarFormulario(h) {
  ['titulo', 'rol', 'accion', 'beneficio', 'criterios', 'responsable', 'prioridad', 'estado', 'puntos']
    .forEach((campo) => {
      document.getElementById(campo).value = h[campo] ?? '';
    });
}

function mostrarErrores(errores) {
  CAMPOS_OBLIGATORIOS.forEach((campo) => {
    const input = document.getElementById(campo);
    const mensaje = errores[campo] || '';
    document.getElementById(`error-${campo}`).textContent = mensaje;
    input.classList.toggle('invalido', Boolean(mensaje));
    input.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
  });

  const primerError = CAMPOS_OBLIGATORIOS.find((campo) => errores[campo]);
  if (primerError) document.getElementById(primerError).focus();
}

// Guardar: crea o actualiza según el modo en que esté el formulario.
function manejarEnvio(evento) {
  evento.preventDefault();

  const datos = leerFormulario();
  const errores = validar(datos);
  mostrarErrores(errores);
  if (Object.keys(errores).length > 0) return;

  const editando = idEnEdicion !== null;
  const historia = editando ? actualizarHistoria(idEnEdicion, datos) : crearHistoria(datos);

  mostrarAviso(editando ? 'Historia actualizada' : 'Historia creada');
  terminarEdicion();
  render();
  resaltarTarjeta(historia && historia.id);
}

function iniciarEdicion(id) {
  const historia = buscarPorId(id);
  if (!historia) return;

  idEnEdicion = id;
  llenarFormulario(historia);
  mostrarErrores({});

  dom.tituloFormulario.textContent = 'Editar historia de usuario';
  dom.botonGuardar.textContent = 'Guardar cambios';
  dom.botonCancelar.hidden = false;
  dom.panelFormulario.classList.add('editando');
  dom.panelFormulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('titulo').focus({ preventScroll: true });
}

// Vuelve el formulario al modo "crear" y lo deja limpio.
function terminarEdicion() {
  idEnEdicion = null;
  dom.formulario.reset();
  mostrarErrores({});

  dom.tituloFormulario.textContent = 'Nueva historia de usuario';
  dom.botonGuardar.textContent = 'Crear historia';
  dom.botonCancelar.hidden = true;
  dom.panelFormulario.classList.remove('editando');
}

/* ---------- 7. Eliminación con confirmación ---------- */

function pedirConfirmacion(id) {
  const historia = buscarPorId(id);
  if (!historia) return;

  idPorEliminar = id;
  dom.dialogoNombre.textContent = `"${historia.titulo}"`;
  dom.dialogo.showModal();
  dom.dialogoCancelar.focus();
}

function confirmarEliminacion() {
  const id = idPorEliminar;
  dom.dialogo.close();

  if (id && eliminarHistoria(id)) {
    if (id === idEnEdicion) terminarEdicion();
    mostrarAviso('Historia eliminada');
    render();
  }
}

/* ---------- 8. Utilidades ---------- */

function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function crearBoton(texto, accion, clase, etiquetaAccesible) {
  const boton = crearElemento('button', clase, texto);
  boton.type = 'button';
  boton.dataset.accion = accion;
  boton.setAttribute('aria-label', etiquetaAccesible);
  return boton;
}

// "En progreso" → "etiqueta--en-progreso"
function claseEstado(estado) {
  return `etiqueta--${normalizar(estado).replace(/\s+/g, '-')}`;
}

// Minúsculas y sin tildes, para que "Contraseña" y "contrasena" coincidan al buscar.
function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function generarId() {
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatearFecha(iso) {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : formatoFecha.format(fecha);
}

let temporizadorAviso;
function mostrarAviso(mensaje) {
  dom.aviso.textContent = mensaje;
  dom.aviso.classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => dom.aviso.classList.remove('visible'), 2200);
}

function resaltarTarjeta(id) {
  if (!id) return;
  const tarjeta = dom.lista.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!tarjeta) return;
  tarjeta.classList.add('resaltada');
  tarjeta.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cargarEjemplos() {
  EJEMPLOS.forEach((ejemplo) => crearHistoria({ ...ejemplo }));
  render();
  mostrarAviso(`Se cargaron ${EJEMPLOS.length} historias de ejemplo`);
}

/* ---------- 9. Eventos e inicio ---------- */

function iniciar() {
  historias = leerStorage();

  // Relaciona cada campo obligatorio con su mensaje de error (accesibilidad)
  CAMPOS_OBLIGATORIOS.forEach((campo) => {
    document.getElementById(campo).setAttribute('aria-describedby', `error-${campo}`);
  });

  dom.formulario.addEventListener('submit', manejarEnvio);
  dom.botonCancelar.addEventListener('click', terminarEdicion);

  // Escape cancela la edición
  dom.formulario.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && idEnEdicion !== null) terminarEdicion();
  });

  // Al corregir un campo con error, el mensaje desaparece
  dom.formulario.addEventListener('input', (evento) => {
    const campo = evento.target;
    if (campo.classList.contains('invalido')) {
      campo.classList.remove('invalido');
      campo.setAttribute('aria-invalid', 'false');
      const mensaje = document.getElementById(`error-${campo.id}`);
      if (mensaje) mensaje.textContent = '';
    }
  });

  // Un solo listener para los botones de todas las tarjetas (delegación de eventos)
  dom.lista.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton) return;

    const id = boton.closest('.tarjeta').dataset.id;
    if (boton.dataset.accion === 'editar') iniciarEdicion(id);
    if (boton.dataset.accion === 'eliminar') pedirConfirmacion(id);
  });

  // Búsqueda y filtros vuelven a dibujar la lista al instante
  dom.buscar.addEventListener('input', render);
  dom.filtroEstado.addEventListener('change', render);
  dom.filtroPrioridad.addEventListener('change', render);

  dom.botonEjemplos.addEventListener('click', cargarEjemplos);

  dom.dialogoCancelar.addEventListener('click', () => dom.dialogo.close());
  dom.dialogoConfirmar.addEventListener('click', confirmarEliminacion);
  dom.dialogo.addEventListener('close', () => {
    idPorEliminar = null;
  });

  // Si la app está abierta en otra pestaña y allí cambian los datos, se sincroniza
  window.addEventListener('storage', (evento) => {
    if (evento.key !== CLAVE_STORAGE) return;
    historias = leerStorage();
    if (idEnEdicion !== null && !buscarPorId(idEnEdicion)) terminarEdicion();
    render();
  });

  render();
}

iniciar();
