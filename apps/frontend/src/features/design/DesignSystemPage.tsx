import { useEffect, useState, type CSSProperties } from 'react';
import {
  Archive,
  BarChart3,
  BookOpen,
  Building2,
  Check,
  ClipboardCheck,
  Download,
  LayoutDashboard,
  Library,
  LineChart,
  Lock,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  Dropdown,
  EmptyState,
  FormField,
  Input,
  Modal,
  Select,
  Spinner,
  Table,
  Tabs,
  Textarea,
  Toggle,
  useToast,
  type Column,
} from '@/components/ui';
import { FileUpload, type FileValue } from '@/components/ui/FileUpload';
import styles from './DesignSystemPage.module.css';

// =============================================================================
// Token catalogue (names only: values are read from the live CSS at runtime)
// =============================================================================

const COLOR_GROUPS: { title: string; tokens: string[] }[] = [
  {
    title: 'Fondos',
    tokens: ['--color-bg-primary', '--color-bg-secondary', '--color-bg-tertiary', '--color-bg-accent'],
  },
  {
    title: 'Texto',
    tokens: ['--color-text-primary', '--color-text-secondary', '--color-text-muted', '--color-text-inverse'],
  },
  {
    title: 'Acento',
    tokens: [
      '--color-accent-primary',
      '--color-accent-hover',
      '--color-accent-active',
      '--color-accent-muted',
      '--color-accent-border',
    ],
  },
  {
    title: 'Semánticos',
    tokens: [
      '--color-success',
      '--color-success-muted',
      '--color-warning',
      '--color-warning-strong',
      '--color-warning-muted',
      '--color-error',
      '--color-error-hover',
      '--color-error-active',
      '--color-error-muted',
      '--color-info',
      '--color-info-muted',
    ],
  },
  { title: 'Neutros', tokens: ['--color-neutral', '--color-neutral-muted', '--color-scrim'] },
  {
    title: 'Bordes',
    tokens: ['--color-border-primary', '--color-border-secondary', '--color-border-focus'],
  },
  {
    title: 'Visualización de datos',
    tokens: Array.from({ length: 8 }, (_, i) => `--color-course-${i + 1}`),
  },
];

const TEXT_SIZES = ['--text-xs', '--text-sm', '--text-base', '--text-lg', '--text-xl', '--text-2xl', '--text-3xl', '--text-4xl'];
const FONT_WEIGHTS = ['--font-normal', '--font-medium', '--font-semibold', '--font-bold', '--font-extrabold'];
const LEADINGS = ['--leading-none', '--leading-tight', '--leading-snug', '--leading-normal', '--leading-relaxed'];
const SPACES = ['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8', '--space-10', '--space-12', '--space-16'];
const RADII = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-2xl', '--radius-full'];
const SHADOWS = ['--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl'];

const ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'LayoutDashboard', Icon: LayoutDashboard },
  { name: 'BookOpen', Icon: BookOpen },
  { name: 'Users', Icon: Users },
  { name: 'ClipboardCheck', Icon: ClipboardCheck },
  { name: 'MessageSquare', Icon: MessageSquare },
  { name: 'BarChart3', Icon: BarChart3 },
  { name: 'LineChart', Icon: LineChart },
  { name: 'Library', Icon: Library },
  { name: 'Building2', Icon: Building2 },
  { name: 'Search', Icon: Search },
  { name: 'Plus', Icon: Plus },
  { name: 'Pencil', Icon: Pencil },
  { name: 'Trash2', Icon: Trash2 },
  { name: 'Archive', Icon: Archive },
  { name: 'Download', Icon: Download },
  { name: 'Mail', Icon: Mail },
  { name: 'Send', Icon: Send },
  { name: 'Lock', Icon: Lock },
  { name: 'ShieldCheck', Icon: ShieldCheck },
  { name: 'Check', Icon: Check },
];

// =============================================================================
// Helpers
// =============================================================================

/** Reads the computed value of CSS variables once the page is mounted. */
function useTokenValues(names: string[]): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});
  const key = names.join('|');
  useEffect(() => {
    const computed = getComputedStyle(document.documentElement);
    setValues(
      Object.fromEntries(names.map((name) => [name, computed.getPropertyValue(name).trim()])),
    );
    // `key` captures the contents of `names`.
  }, [key]);
  return values;
}

const ALL_COLORS = COLOR_GROUPS.flatMap((g) => g.tokens);
const ALL_TOKENS = [
  ...ALL_COLORS,
  ...TEXT_SIZES,
  ...FONT_WEIGHTS,
  ...LEADINGS,
  ...SPACES,
  ...RADII,
  ...SHADOWS,
  '--font-sans',
  '--font-mono',
];

interface DemoRow {
  id: string;
  course: string;
  status: 'Activo' | 'Archivado';
  students: number;
}
const DEMO_ROWS: DemoRow[] = [
  { id: '1', course: 'Matemáticas 1.º', status: 'Activo', students: 28 },
  { id: '2', course: 'Historia contemporánea', status: 'Activo', students: 24 },
  { id: '3', course: 'Física 2.º', status: 'Archivado', students: 19 },
];
const DEMO_COLUMNS: Column<DemoRow>[] = [
  { key: 'course', header: 'Curso' },
  {
    key: 'status',
    header: 'Estado',
    render: (row) => <Badge variant={row.status === 'Activo' ? 'success' : 'neutral'}>{row.status}</Badge>,
  },
  { key: 'students', header: 'Alumnos', align: 'right' },
];

const ROLE_OPTIONS = [
  { value: 'STUDENT', label: 'Alumno' },
  { value: 'TEACHER', label: 'Profesor' },
  { value: 'ADMIN', label: 'Administrador' },
];

// =============================================================================
// Page
// =============================================================================

export function DesignSystemPage() {
  const tokens = useTokenValues(ALL_TOKENS);
  const { toast } = useToast();
  const [toggleOn, setToggleOn] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [files, setFiles] = useState<FileValue[]>([]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Guía de estilo</span>
        <h1>Sistema de diseño</h1>
        <p>
          Paleta, tipografía, iconos y componentes de Klass. Todo se define en{' '}
          <code>components/ui/tokens.css</code> y <code>components/ui/*</code>; esta página lee los
          valores reales de las variables CSS.
        </p>
        <nav aria-label="Secciones" className={styles.toc}>
          <a href="#paleta">Paleta</a>
          <a href="#tipografia">Tipografía</a>
          <a href="#escalas">Espaciado, radios y sombras</a>
          <a href="#iconos">Iconos</a>
          <a href="#componentes">Componentes</a>
        </nav>
      </header>

      {/* ---------------------------------------------------------------- Paleta */}
      <section id="paleta" className={styles.section} aria-labelledby="paleta-title">
        <h2 id="paleta-title">Paleta</h2>
        {COLOR_GROUPS.map((group) => (
          <div key={group.title} className={styles.group}>
            <h3>{group.title}</h3>
            <ul className={styles.swatches}>
              {group.tokens.map((name) => (
                <li key={name} className={styles.swatch}>
                  <span
                    className={styles.swatchColor}
                    style={{ background: `var(${name})` } as CSSProperties}
                    aria-hidden="true"
                  />
                  <code className={styles.tokenName}>{name}</code>
                  <span className={styles.tokenValue}>{tokens[name] ?? ''}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------------ Tipografía */}
      <section id="tipografia" className={styles.section} aria-labelledby="tipografia-title">
        <h2 id="tipografia-title">Tipografía</h2>
        <div className={styles.group}>
          <h3>Familias</h3>
          <p className={styles.fontSample} style={{ fontFamily: 'var(--font-sans)' }}>
            Hanken Grotesk: Aprender es mejor en equipo
          </p>
          <p className={styles.tokenValue}>
            <code>--font-sans</code> {tokens['--font-sans']}
          </p>
          <p className={styles.fontSample} style={{ fontFamily: 'var(--font-mono)' }}>
            Monoespaciada: const curso = 42;
          </p>
          <p className={styles.tokenValue}>
            <code>--font-mono</code> {tokens['--font-mono']}
          </p>
        </div>
        <div className={styles.group}>
          <h3>Escala de tamaños</h3>
          <ul className={styles.typeScale}>
            {TEXT_SIZES.map((name) => (
              <li key={name}>
                <code className={styles.tokenName}>{name}</code>
                <span className={styles.tokenValue}>{tokens[name]}</span>
                <span className={styles.typeSample} style={{ fontSize: `var(${name})` }}>
                  Los cursos de hoy
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.group}>
          <h3>Pesos</h3>
          <ul className={styles.typeScale}>
            {FONT_WEIGHTS.map((name) => (
              <li key={name}>
                <code className={styles.tokenName}>{name}</code>
                <span className={styles.tokenValue}>{tokens[name]}</span>
                <span className={styles.typeSample} style={{ fontWeight: `var(${name})` }}>
                  Los cursos de hoy
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.group}>
          <h3>Interlineado</h3>
          <ul className={styles.leadings}>
            {LEADINGS.map((name) => (
              <li key={name}>
                <code className={styles.tokenName}>{name}</code>
                <span className={styles.tokenValue}>{tokens[name]}</span>
                <p style={{ lineHeight: `var(${name})` }}>
                  Una lección bien estructurada ayuda a que cada estudiante avance a su ritmo.
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------- Espaciado, radios y sombras */}
      <section id="escalas" className={styles.section} aria-labelledby="escalas-title">
        <h2 id="escalas-title">Espaciado, radios y sombras</h2>
        <div className={styles.group}>
          <h3>Espaciado</h3>
          <ul className={styles.typeScale}>
            {SPACES.map((name) => (
              <li key={name}>
                <code className={styles.tokenName}>{name}</code>
                <span className={styles.tokenValue}>{tokens[name]}</span>
                <span className={styles.spaceBar} style={{ width: `var(${name})` }} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.group}>
          <h3>Radios</h3>
          <ul className={styles.boxes}>
            {RADII.map((name) => (
              <li key={name}>
                <span className={styles.box} style={{ borderRadius: `var(${name})` }} aria-hidden="true" />
                <code className={styles.tokenName}>{name}</code>
                <span className={styles.tokenValue}>{tokens[name]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.group}>
          <h3>Sombras</h3>
          <ul className={styles.boxes}>
            {SHADOWS.map((name) => (
              <li key={name}>
                <span className={styles.box} style={{ boxShadow: `var(${name})` }} aria-hidden="true" />
                <code className={styles.tokenName}>{name}</code>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Iconos */}
      <section id="iconos" className={styles.section} aria-labelledby="iconos-title">
        <h2 id="iconos-title">Iconos</h2>
        <p className={styles.lead}>
          Biblioteca <code>lucide-react</code> (licencia ISC), con trazo de 2 px y tamaños de 16 a 24 px. Muestra de
          los iconos que se usan en la aplicación.
        </p>
        <ul className={styles.icons}>
          {ICONS.map(({ name, Icon }) => (
            <li key={name}>
              <Icon size={24} aria-hidden="true" />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ----------------------------------------------------------- Componentes */}
      <section id="componentes" className={styles.section} aria-labelledby="componentes-title">
        <h2 id="componentes-title">Componentes</h2>

        <Card title="Button" titleAs="h3" subtitle="Variantes, tamaños y estados">
          <div className={styles.stack}>
            <div className={styles.row}>
              <Button variant="primary">Primario</Button>
              <Button variant="secondary">Secundario</Button>
              <Button variant="outline">Contorno</Button>
              <Button variant="ghost">Fantasma</Button>
              <Button variant="danger">Peligro</Button>
            </div>
            <div className={styles.row}>
              <Button size="sm">Pequeño</Button>
              <Button size="md">Mediano</Button>
              <Button size="lg">Grande</Button>
            </div>
            <div className={styles.row}>
              <Button leftIcon={<Plus size={16} />}>Con icono</Button>
              <Button variant="outline" rightIcon={<Download size={16} />}>
                Descargar
              </Button>
              <Button loading>Cargando</Button>
              <Button disabled>Deshabilitado</Button>
              <Button variant="danger" disabled>
                Peligro deshabilitado
              </Button>
            </div>
            <Button fullWidth variant="secondary">
              Ancho completo
            </Button>
          </div>
        </Card>

        <Card title="Input, Textarea, Select, DatePicker" titleAs="h3" subtitle="Etiqueta, pista, error y deshabilitado">
          <div className={styles.formGrid}>
            <Input label="Correo electrónico" placeholder="nombre@organizacion.es" leftIcon={<Mail size={18} />} hint="Usaremos este correo para avisarte." fullWidth />
            <Input label="Contraseña" type="password" defaultValue="abc" error="Debe tener al menos 8 caracteres." leftIcon={<Lock size={18} />} fullWidth />
            <Input label="Deshabilitado" defaultValue="Solo lectura" disabled fullWidth />
            <Input label="Tamaño pequeño" size="sm" placeholder="sm" fullWidth />
            <Input label="Tamaño grande" size="lg" placeholder="lg" fullWidth />
            <Select label="Rol" options={ROLE_OPTIONS} placeholder="Elige un rol" defaultValue="" fullWidth />
            <Select label="Rol con error" options={ROLE_OPTIONS} defaultValue="" placeholder="Elige un rol" error="Selecciona un rol." fullWidth />
            <Select label="Select deshabilitado" options={ROLE_OPTIONS} defaultValue="TEACHER" disabled fullWidth />
            <DatePicker label="Fecha de entrega" mode="date" hint="Opcional" fullWidth />
            <DatePicker label="Fecha y hora" mode="datetime" error="La fecha ya ha pasado." fullWidth />
            <Textarea label="Descripción" rows={3} placeholder="Escribe aquí…" hint="Máximo 500 caracteres." fullWidth />
            <Textarea label="Comentario con error" rows={3} error="Este campo es obligatorio." fullWidth />
          </div>
        </Card>

        <Card title="FormField" titleAs="h3" subtitle="Envoltorio con etiqueta, pista y error para cualquier control">
          <div className={styles.formGrid}>
            <FormField label="Color favorito" hint="Control nativo con la accesibilidad conectada" required>
              {(field) => <input {...field} type="color" defaultValue="#2563eb" />}
            </FormField>
            <FormField label="Campo con error" error="Este valor no es válido.">
              {(field) => <input {...field} defaultValue="???" />}
            </FormField>
          </div>
        </Card>

        <Card title="Toggle" titleAs="h3" subtitle="Interruptor accesible">
          <div className={styles.row}>
            <label className={styles.inlineLabel}>
              <Toggle checked={toggleOn} onChange={setToggleOn} aria-label="Notificaciones por correo" />
              Notificaciones por correo: {toggleOn ? 'activadas' : 'desactivadas'}
            </label>
            <label className={styles.inlineLabel}>
              <Toggle checked={false} onChange={() => undefined} disabled aria-label="Opción deshabilitada" />
              Deshabilitado
            </label>
          </div>
        </Card>

        <Card title="Badge, Avatar y Spinner" titleAs="h3">
          <div className={styles.stack}>
            <div className={styles.row}>
              <Badge variant="neutral">Neutral</Badge>
              <Badge variant="accent">Acento</Badge>
              <Badge variant="success">Éxito</Badge>
              <Badge variant="warning">Aviso</Badge>
              <Badge variant="error">Error</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="success" dot>
                Con punto
              </Badge>
            </div>
            <div className={styles.row}>
              <Avatar size="xs" alt="Avatar extra pequeño" />
              <Avatar size="sm" alt="Avatar pequeño" />
              <Avatar size="md" alt="Avatar mediano" />
              <Avatar size="lg" alt="Avatar grande" />
            </div>
            <div className={styles.row}>
              <Spinner size="sm" label="Cargando (pequeño)" />
              <Spinner size="md" label="Cargando (mediano)" />
              <Spinner size="lg" label="Cargando (grande)" />
            </div>
          </div>
        </Card>

        <Card title="Card" titleAs="h3" subtitle="Título, subtítulo, pie y relleno">
          <div className={styles.cards}>
            <Card title="Con pie" titleAs="h4" subtitle="Subtítulo" footer={<Button size="sm">Acción</Button>} padding="sm">
              Contenido de la tarjeta.
            </Card>
            <Card title="Interactiva" titleAs="h4" hoverable>
              Resalta al pasar el cursor.
            </Card>
            <Card padding="lg">Sin título, relleno grande.</Card>
          </div>
        </Card>

        <Card title="Tabs" titleAs="h3" subtitle="Teclado: flechas izquierda y derecha">
          <Tabs
            tabs={[
              { id: 'resumen', label: 'Resumen', content: <p>Contenido de la pestaña Resumen.</p> },
              { id: 'tareas', label: 'Tareas', content: <p>Contenido de la pestaña Tareas.</p> },
              { id: 'bloqueada', label: 'Deshabilitada', content: <p>No visible.</p>, disabled: true },
            ]}
          />
        </Card>

        <Card title="Table y EmptyState" titleAs="h3">
          <div className={styles.stack}>
            <Table columns={DEMO_COLUMNS} data={DEMO_ROWS} rowKey={(row) => row.id} />
            <Table columns={DEMO_COLUMNS} data={[]} rowKey={(row) => row.id} empty="No hay cursos todavía." />
            <EmptyState
              icon={<Search size={32} />}
              title="Sin resultados"
              description="Prueba con otros filtros o crea un curso nuevo."
              action={<Button leftIcon={<Plus size={16} />}>Crear curso</Button>}
            />
          </div>
        </Card>

        <Card title="Dropdown, Modal, ConfirmDialog y Toast" titleAs="h3" subtitle="Superposiciones: se cierran con Escape">
          <div className={styles.row}>
            <Dropdown
              trigger="Acciones"
              items={[
                { label: 'Editar', icon: <Pencil size={16} />, onClick: () => toast({ message: 'Editar', variant: 'info' }) },
                { label: 'Archivar', icon: <Archive size={16} /> },
                { label: 'No disponible', disabled: true },
                { label: 'Eliminar', icon: <Trash2 size={16} />, danger: true },
              ]}
            />
            <Button variant="outline" onClick={() => setModalOpen(true)}>
              Abrir modal
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Confirmar eliminación
            </Button>
          </div>
          <div className={styles.row}>
            <Button size="sm" variant="secondary" onClick={() => toast({ message: 'Curso creado', variant: 'success' })}>
              Toast éxito
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast({ message: 'No se pudo guardar', variant: 'error' })}>
              Toast error
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast({ title: 'Aviso', message: 'La entrega vence mañana', variant: 'warning' })}>
              Toast aviso
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast({ message: 'Nueva lección disponible', variant: 'info' })}>
              Toast info
            </Button>
          </div>
        </Card>

        <Card title="FileUpload" titleAs="h3" subtitle="Validación en cliente; aquí sin subida al servidor">
          <FileUpload
            organizationId="design-system-demo"
            autoUpload={false}
            multiple
            maxFiles={3}
            accept=".pdf,.png,.jpg"
            maxSizeBytes={2 * 1024 * 1024}
            hint="PDF, PNG o JPG de hasta 2 MB."
            value={files}
            onChange={setFiles}
          />
        </Card>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal de ejemplo"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setModalOpen(false)} leftIcon={<Check size={16} />}>
              Aceptar
            </Button>
          </>
        }
      >
        <p>El foco queda dentro del modal y vuelve al botón al cerrarlo.</p>
      </Modal>
      <ConfirmDialog
        open={confirmOpen}
        title="Eliminar curso"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          toast({ message: 'Curso eliminado', variant: 'success' });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
