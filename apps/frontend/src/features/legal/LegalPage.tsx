import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';

type LegalDocument = 'privacy' | 'terms';

interface LegalPageProps {
  document: LegalDocument;
}

const COPY = {
  privacy: {
    title: 'Política de privacidad',
    summary: 'Cómo Klass trata la información necesaria para prestar el servicio educativo.',
    sections: [
      ['Responsable y alcance', 'Klass es la plataforma de aprendizaje de la organización en la que tienes una cuenta. Esta política se aplica a los datos tratados al registrarte, acceder a cursos, entregar actividades y usar las herramientas de comunicación de Klass.'],
      ['Datos que tratamos', 'Tratamos los datos de cuenta y perfil que proporcionas, tu pertenencia a la organización, tu actividad académica (matrículas, progreso, entregas, calificaciones) y los archivos que subes. También registramos datos técnicos mínimos de sesión y seguridad para proteger el acceso.'],
      ['Finalidad y conservación', 'Usamos estos datos para autenticarte, mostrarte el contenido y las calificaciones que te corresponden, permitir la colaboración en cursos y mantener la seguridad del servicio. Conservamos la información mientras mantengas una cuenta o mientras la organización deba conservar el historial académico conforme a su política.'],
      ['Acceso y destinatarios', 'Solo pueden acceder a tus datos las personas autorizadas de tu organización según su rol y relación con cada curso. No vendemos datos personales ni los usamos para publicidad. Los proveedores de infraestructura solo los tratan para alojar y operar el servicio bajo instrucciones de Klass.'],
      ['Tus derechos y contacto', 'Puedes solicitar acceso, corrección o eliminación de los datos que controlas desde tu perfil o a través del administrador de tu organización. Para cualquier consulta de privacidad, contacta con la organización que gestiona tu cuenta.'],
    ],
  },
  terms: {
    title: 'Términos de servicio',
    summary: 'Las condiciones para usar Klass de forma segura y respetuosa dentro de tu organización.',
    sections: [
      ['Uso de la plataforma', 'Klass está destinado a la enseñanza y la colaboración de las organizaciones que lo habilitan. Debes usar una cuenta autorizada, mantener protegidas tus credenciales y proporcionar información veraz al completar formularios o entregas.'],
      ['Contenido y conducta', 'Eres responsable del contenido que publicas o subes. No puedes usar la plataforma para compartir material ilegal, perjudicial, que infrinja derechos de terceros, que incluya malware o que interfiera con el uso de otras personas. El personal autorizado puede moderar contenido conforme a las normas de la organización.'],
      ['Disponibilidad y seguridad', 'Aplicamos medidas razonables para mantener el servicio disponible y proteger los datos, pero ningún sistema puede garantizar disponibilidad ininterrumpida. Informa de inmediato al administrador si sospechas que una cuenta o archivo ha sido comprometido.'],
      ['Propiedad y licencias', 'Conservas los derechos sobre tu contenido. Al subirlo, autorizas a Klass y a los miembros autorizados de tu organización a almacenarlo, procesarlo y mostrarlo únicamente para prestar las funciones educativas solicitadas.'],
      ['Cambios y contacto', 'Podemos actualizar estos términos cuando cambie el servicio o la normativa aplicable. Si el cambio es relevante, se comunicará a la organización. Para dudas sobre estas condiciones, contacta con el administrador de tu organización.'],
    ],
  },
} as const;

export function LegalPage({ document }: LegalPageProps) {
  const content = COPY[document];

  return (
    <main className={styles.page}>
      <article className={styles.document} aria-labelledby="legal-title">
        <Link className={styles.back} to="/login">Volver al acceso</Link>
        <p className={styles.eyebrow}>Klass · vigente desde el 3 de septiembre de 2026</p>
        <h1 id="legal-title">{content.title}</h1>
        <p className={styles.summary}>{content.summary}</p>
        {content.sections.map(([heading, body]) => (
          <section key={heading} className={styles.section} aria-labelledby={heading}>
            <h2 id={heading}>{heading}</h2>
            <p>{body}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
