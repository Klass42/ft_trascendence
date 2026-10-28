import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/api';
import { LEGAL_INFO } from './legalInfo';
import styles from './LegalPage.module.css';

type LegalDocument = 'privacy' | 'terms';

interface LegalPageProps {
  document: LegalDocument;
}

interface LegalCopy {
  title: string;
  summary: string;
  sections: ReadonlyArray<readonly [heading: string, body: ReactNode]>;
}

const contactLink = (
  <>
    {LEGAL_INFO.contactLabel} (
    <a href={LEGAL_INFO.contactUrl} target="_blank" rel="noopener noreferrer">
      {LEGAL_INFO.contactUrl}
    </a>
    )
  </>
);

const COPY: Record<LegalDocument, LegalCopy> = {
  privacy: {
    title: 'Política de privacidad',
    summary: 'Cómo Klass trata la información necesaria para prestar el servicio educativo.',
    sections: [
      [
        'Responsable y alcance',
        <>
          El responsable del tratamiento es {LEGAL_INFO.controller}. Klass es la plataforma de
          aprendizaje de la organización en la que tienes una cuenta; para los datos académicos de
          esa organización (cohortes, asignaturas, entregas, calificaciones) tu punto de contacto es{' '}
          {LEGAL_INFO.organizationContact}. Esta política se aplica a los datos tratados al
          registrarte, acceder a tus asignaturas, entregar tareas y usar las herramientas de
          comunicación de Klass.
        </>,
      ],
      [
        'Datos que tratamos',
        'Tratamos los datos de cuenta y perfil que proporcionas (nombre, correo electrónico, foto, preferencias), tu pertenencia a la organización, tus relaciones de amistad dentro de ella, tu actividad académica (matrículas, progreso, entregas, calificaciones), tus mensajes en los foros y los archivos que subes. También registramos datos técnicos mínimos de sesión y seguridad para proteger el acceso.',
      ],
      [
        'Finalidad y conservación',
        'Usamos estos datos para autenticarte, mostrarte el contenido y las calificaciones que te corresponden, permitir la colaboración en las asignaturas y mantener la seguridad del servicio. Conservamos la información mientras mantengas una cuenta o mientras la organización deba conservar el historial académico conforme a su política. Cuando el administrador de una organización elimina una cuenta, la eliminación es definitiva y no se puede deshacer. Los administradores también pueden solicitar al equipo de la plataforma la eliminación de toda su organización; esa solicitud la revisa el equipo antes de ejecutarse.',
      ],
      [
        'Acceso y destinatarios',
        'Solo pueden acceder a tus datos las personas autorizadas de tu organización según su rol y relación con cada asignatura. No vendemos datos personales ni los usamos para publicidad. Los proveedores de infraestructura solo los tratan para alojar y operar el servicio bajo instrucciones de Klass.',
      ],
      [
        'Tus derechos y contacto',
        <>
          Desde tu perfil puedes corregir tu nombre, cambiar o quitar tu foto, cambiar tu
          contraseña y ajustar tus preferencias de notificaciones por email e idioma. Hoy Klass no
          ofrece la eliminación de tu propia cuenta ni la descarga automática de tus datos desde el
          perfil: para solicitar acceso a una copia de tus datos, su corrección cuando no puedas
          hacerla tú o la eliminación de tu cuenta, contacta con {LEGAL_INFO.organizationContact},
          que puede eliminar cuentas de su organización. Para cualquier otra consulta de
          privacidad, o si no obtienes respuesta, escribe al equipo de Klass en {contactLink}; esa página es pública, así que no
          incluyas en ella datos personales ni contraseñas.
        </>,
      ],
    ],
  },
  terms: {
    title: 'Términos de servicio',
    summary: 'Las condiciones para usar Klass de forma segura y respetuosa dentro de tu organización.',
    sections: [
      [
        'Uso de la plataforma',
        'Klass está destinado a la enseñanza y la colaboración de las organizaciones que lo habilitan. Debes usar una cuenta autorizada, mantener protegidas tus credenciales y proporcionar información veraz al completar formularios o entregas.',
      ],
      [
        'Contenido y conducta',
        'Eres responsable del contenido que publicas o subes. No puedes usar la plataforma para compartir material ilegal, perjudicial, que infrinja derechos de terceros, que incluya malware o que interfiera con el uso de otras personas. El personal autorizado puede moderar contenido conforme a las normas de la organización.',
      ],
      [
        'Cuentas',
        <>
          Las cuentas las gestiona {LEGAL_INFO.organizationContact}, que puede crearlas, cambiar su
          rol y eliminarlas de forma definitiva. Desde tu perfil puedes editar tus datos básicos,
          pero no eliminar tu propia cuenta: solicítalo a esa persona.
        </>,
      ],
      [
        'Disponibilidad y seguridad',
        'Aplicamos medidas razonables para mantener el servicio disponible y proteger los datos, pero ningún sistema puede garantizar disponibilidad ininterrumpida. Informa de inmediato al administrador si sospechas que una cuenta o archivo ha sido comprometido.',
      ],
      [
        'Propiedad y licencias',
        'Conservas los derechos sobre tu contenido. Al subirlo, autorizas a Klass y a los miembros autorizados de tu organización a almacenarlo, procesarlo y mostrarlo únicamente para prestar las funciones educativas solicitadas.',
      ],
      [
        'Cambios y contacto',
        <>
          Podemos actualizar estos términos cuando cambie el servicio o la normativa aplicable; la
          fecha de la última actualización figura al principio de esta página. El servicio lo
          presta {LEGAL_INFO.controller}. Para dudas sobre estas condiciones, contacta con{' '}
          {LEGAL_INFO.organizationContact} o con el equipo de Klass en {contactLink}.
        </>,
      ],
    ],
  },
};

export function LegalPage({ document }: LegalPageProps) {
  const content = COPY[document];
  const { user } = useAuth();
  const isPlatformAdmin = user?.platformRole === 'SUPERADMIN';
  const back = !user
    ? { to: '/login', label: 'Volver al acceso' }
    : isPlatformAdmin
      ? { to: '/platform', label: 'Volver a la plataforma' }
      : { to: '/dashboard', label: 'Volver al inicio' };

  return (
    <main className={styles.page}>
      <article className={styles.document} aria-labelledby="legal-title">
        <Link className={styles.back} to={back.to}>{back.label}</Link>
        <p className={styles.eyebrow}>
          {LEGAL_INFO.productName} · Última actualización: {LEGAL_INFO.lastUpdated}
        </p>
        <h1 id="legal-title">{content.title}</h1>
        <p className={styles.summary}>{content.summary}</p>
        {content.sections.map(([heading, body], index) => (
          <section key={heading} className={styles.section} aria-labelledby={`legal-section-${index}`}>
            <h2 id={`legal-section-${index}`}>{heading}</h2>
            <p>{body}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
