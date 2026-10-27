# Klass — Lenguaje visual & Design System (Épica 0)

> Referencia para construir pantallas consistentes. **Regla de oro: compón los componentes de
> `@/components/ui`; NO inventes estilos inline ni colores/espaciados a mano.** Si necesitas un
> componente que no existe, añádelo a `components/ui` (con su `.module.css` y tokens), no lo improvises
> en la página.

## Tokens (usar SIEMPRE variables, nunca valores crudos)
Definidos en `components/ui/tokens.css`:
- **Color**: `--color-bg-primary/secondary/tertiary`, `--color-text-primary/secondary/muted`,
  `--color-accent-*`, semánticos `--color-success/warning/error/info(-muted)`, `--color-border-*`.
- **Espaciado** (base 8px): `--space-1..16`.
- **Tipografía**: `--font-sans`, `--text-xs..4xl`, `--font-normal..extrabold`, `--leading-*`.
- **Radios**: `--radius-sm..2xl/full`. **Sombras**: `--shadow-sm..xl`. **Z-index**: `--z-dropdown..toast`.
- **Transiciones**: `--transition-fast/base/slow`.

## Componentes disponibles (`import { … } from '@/components/ui'`)
| Componente | Cuándo usarlo |
|---|---|
| `Button` | Acciones (`variant`: primary/secondary/outline/ghost/danger; `loading`, `leftIcon`) |
| `Input` / `Textarea` / `Select` / `DatePicker` | Campos de formulario (label/error/hint incorporados) |
| `FormField` | Envolver un control custom con label/error/hint (render-prop) |
| `Badge` | Estados/etiquetas (success/warning/error/info/accent/neutral, `dot`) |
| `Modal` | Diálogo (backdrop, Esc, foco, `footer` para acciones) |
| `ConfirmDialog` | Confirmar acciones (usa `variant="danger"` para destructivas) |
| `Dropdown` | Menú de acciones (`trigger` = contenido, NO un `<Button>`) |
| `Table` | Listados/roster/gradebook (data-driven, con `empty`) |
| `Tabs` | Secciones dentro de una página (Contenido/Alumnos/…) |
| `EmptyState` | "Nada aún" con icono + título + descripción + acción |
| `useToast()` / `ToastProvider` | Feedback efímero (ya montado en `main.tsx`) |
| `Card`, `Spinner`, `FileUpload` | (existentes) contenedor, carga, subida de ficheros |

## Patrones de página (Definition of Done visual)
- **Cabecera**: título (`--text-2xl`, `--font-bold`) + acciones a la derecha (Button primario para la
  acción principal).
- **Estados obligatorios** en toda vista con datos:
  - **Cargando** → `Spinner` (o skeleton).
  - **Vacío** → `EmptyState` (nunca "No hay datos" pelado).
  - **Error** → mensaje claro + reintento (no pantalla en blanco ni error de consola).
- **Formularios**: usa los controles del kit (traen label/error). Valida en cliente Y servidor. Acciones
  al pie (primario a la derecha, `ghost`/Cancelar a su izquierda). En Modal, van en `footer`.
- **Tablas**: `Table` con `empty`. Acciones por fila → `Dropdown`. Estado → `Badge`.
- **Feedback**: tras crear/editar/borrar → `toast({ variant: 'success', message: … })`. Acción
  destructiva → `ConfirmDialog` antes.
- **Responsive**: nada con scroll horizontal en el body; tablas y bloques anchos con su propio scroll.
- **Accesibilidad**: labels asociados, foco visible, navegable por teclado, `aria-*` donde aplique.
- **Cero errores de consola.**

## Anti-patrones (rechazados en revisión)
- `style={{…}}` con colores/espaciados crudos (usa tokens o el componente).
- Datos mock/hardcodeados en producción.
- Botones/inputs "a mano" en vez del kit.
- Vistas sin estado vacío/carga/error.

---

## Glosario de texto de la interfaz

Guía corta para que todo el texto visible use las mismas palabras. Los identificadores de
código, rutas y campos de la API **no cambian** (están en inglés: `Course`, `Subject`,
`Activity`, `Question`…); esta tabla solo fija cómo se llaman en pantalla.

### Estructura académica

| En pantalla | Qué es | En el código | Nunca en la UI |
|---|---|---|---|
| **Cohorte** | Grupo de alumnos de un año académico, p. ej. «1º A · 2025-2026». Es lo que lista la sección «Cohortes». | `Course` | «Curso» |
| **Asignatura** | Materia dentro de una cohorte. Los selectores de Tareas, Foros, Notas, Analíticas y Biblioteca eligen asignaturas. | `Subject` (`useMySubjects`) | «Curso» |
| **Año académico** | Periodo de la cohorte, p. ej. «2026-2027». | `academicYear` | — |
| **Sección** y **Lección** | Estructura del contenido de una asignatura (libro → secciones → lecciones). | `Section`, `Lesson` | — |
| **Recurso** / **Biblioteca** | Material reutilizable de la organización (libros, enlaces, documentos). Se «publica en una asignatura». | `LearningResource` | — |

### Evaluación

| En pantalla | Qué es | En el código | Nunca en la UI |
|---|---|---|---|
| **Tarea** | Lo que el profesor publica y el alumno realiza. | `Activity` (y `Assignment`, heredado) | «Actividad» (salvo «Actividad de foro» y «actividad académica» en sentido general) |
| **Pregunta** | Cada elemento evaluable de una tarea. | `Question` | «Bloque» |
| **Enunciado** | Texto/recursos que explican qué hay que hacer. | `description`, `prompt` | — |
| **Intento** | Cada vez que un alumno realiza una tarea. | `Attempt` | — |
| **Entrega** | Un intento enviado al profesor. | `submittedAt`, `Submission` | — |
| **Calificaciones** | Vista del profesor con las notas de sus alumnos (`/grades`). | `gradebook` | «Datos», «gradebook», «libro de notas» |
| **Mis notas** | Vista del alumno con sus notas (`/grades`). | — | «Datos» |
| **Nota** | Valor numérico de una entrega o pregunta. | `score`, `awarded` | — |
| **Archivo** | Fichero subido. | `File` | «Fichero» |

El menú lateral usa el mismo nombre que el título de la página: alumnos ven «Mis notas»,
profesores «Calificaciones»; todos ven «Cohortes».

### Personas y organización

| En pantalla | Notas |
|---|---|
| **Organización** | El centro/academia. El identificador de acceso se llama «Código de organización». |
| **Administrador** | Rol `ADMIN`. No usar «Admin» en etiquetas (sí en textos técnicos como `admin@…`). |
| **Profesor** | Rol `TEACHER`. |
| **Alumno** | Rol `STUDENT`. No usar «Estudiante». |
| **Correo electrónico** | Siempre así en etiquetas, errores y ayudas. Nunca «Email» ni «e-mail» (excepción: la parte de ejemplo de un placeholder, p. ej. `nombre@ejemplo.es`). |
| **Contraseña**, **Iniciar sesión**, **Cerrar sesión** | Fijos; los usan los tests e2e. |

### Estados (concordancia de género)

| Sustantivo | Borrador | Publicado | Archivado | Planificado |
|---|---|---|---|---|
| Cohorte (f.) | — | — | Archivada | Planificada |
| Asignatura (f.) | Borrador | Publicada | Archivada | — |
| Tarea (f.) | Borrador | Publicada | Archivada | — |
| Organización (f.) | — | Activa | Archivada | — |
| Recurso (m.) | Borrador | Publicado | Archivado | — |

«En curso» es invariable. Los mensajes de confirmación concuerdan con el sustantivo:
«Asignatura archivada», «Cohorte archivada», «Tarea archivada», «Recurso archivado».

### Formatos y plurales

- Fechas: usar siempre `src/lib/format.ts` (locale `es-ES`). Corta «27 oct 2026», con hora
  «27 oct 2026, 23:03», cabecera «Martes, 27 de octubre» (solo la primera letra en mayúscula).
  No llamar directamente a `toLocaleDateString` / `Intl.DateTimeFormat` en las pantallas.
- Plurales: `plural(n, 'recurso', 'recursos')` → «1 recurso», «2 recursos». Nada de «(s)».
  Los verbos concuerdan con el número: «Se ha eliminado 1 recurso», «Se han eliminado 2 recursos».
- Errores de validación: el formulario valida en español (`noValidate` en todos los `<form>`);
  no depender de los mensajes nativos del navegador.
- Mensajes del backend: siempre en español (clase de excepción y estado HTTP no cambian).
  Los mensajes por defecto de `class-validator` se traducen en
  `apps/backend/src/common/pipes/validation-errors.ts`; un `message` explícito en el decorador
  tiene prioridad. El límite de peticiones responde «Demasiados intentos. Espera un momento y
  vuelve a intentarlo.».

### Pendiente de unificar

- «Borrar» (cohortes, asignaturas, tareas, hilos) frente a «Eliminar» (lecciones, secciones,
  recursos, usuarios). Se mantiene tal cual porque los tests e2e lo usan; elegir uno en un
  cambio aparte.
