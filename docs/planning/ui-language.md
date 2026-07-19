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
