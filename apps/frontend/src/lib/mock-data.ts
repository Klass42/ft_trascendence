export interface Lesson {
  id: string;
  title: string;
  min: number;
  done: boolean;
}

export interface Section {
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  code: string;
  title: string;
  teacher: string;
  color: string;
  tint: string;
  sections: Section[];
}

export interface Assignment {
  id: string;
  code: string;
  course: string;
  title: string;
  due: string;
  status: 'pendiente' | 'entregado' | 'calificado';
  score?: string;
}

export interface Submission {
  id: string;
  student: string;
  initials: string;
  title: string;
  course: string;
  when: string;
}

export interface Reply {
  author: string;
  initials: string;
  me: boolean;
  teacher: boolean;
  body: string;
  when: string;
}

export interface Thread {
  id: string;
  code: string;
  title: string;
  author: string;
  pinned: boolean;
  replies: Reply[];
}

export interface Grade {
  course: string;
  item: string;
  score: string;
  color: string;
}

export interface PlatformUser {
  name: string;
  initials: string;
  role: string;
  joined: string;
}

export interface Notification {
  id: string;
  type: 'grade' | 'forum' | 'assignment' | 'reminder';
  text: string;
  time: string;
  read: boolean;
}

export const courses: Course[] = [
  {
    id: 'di',
    code: 'DI',
    title: 'Diseño de Interfaces',
    teacher: 'Marta Ruiz',
    color: '#2563eb',
    tint: '#eff4ff',
    sections: [
      {
        title: 'Módulo 1 · Fundamentos',
        lessons: [
          { id: 'di1', title: 'Principios de percepción visual', min: 8, done: true },
          { id: 'di2', title: 'Jerarquía y contraste', min: 12, done: true },
        ],
      },
      {
        title: 'Módulo 2 · Layout & grids',
        lessons: [
          { id: 'di3', title: 'Sistemas de rejilla', min: 10, done: true },
          { id: 'di4', title: 'Espaciado y ritmo vertical', min: 15, done: false },
          { id: 'di5', title: 'Responsive y breakpoints', min: 15, done: false },
        ],
      },
    ],
  },
  {
    id: 'bd',
    code: 'BD',
    title: 'Bases de Datos',
    teacher: 'Jorge Alba',
    color: '#0f766e',
    tint: '#e0f2ec',
    sections: [
      {
        title: 'Módulo 1 · Modelo relacional',
        lessons: [
          { id: 'bd1', title: 'Entidades y relaciones', min: 11, done: true },
          { id: 'bd2', title: 'Normalización', min: 14, done: false },
          { id: 'bd3', title: 'SQL: consultas con JOIN', min: 16, done: false },
        ],
      },
    ],
  },
  {
    id: 'al',
    code: 'AL',
    title: 'Álgebra Lineal',
    teacher: 'Nadia Sanz',
    color: '#d97706',
    tint: '#fdeede',
    sections: [
      {
        title: 'Módulo 1 · Vectores',
        lessons: [
          { id: 'al1', title: 'Espacios vectoriales', min: 12, done: true },
          { id: 'al2', title: 'Producto escalar', min: 9, done: true },
        ],
      },
    ],
  },
  {
    id: 'rc',
    code: 'RC',
    title: 'Redes de Computadores',
    teacher: 'Iván Robles',
    color: '#7c3aed',
    tint: '#ede9fe',
    sections: [
      {
        title: 'Módulo 1 · Fundamentos',
        lessons: [
          { id: 'rc1', title: 'Modelo OSI', min: 13, done: false },
        ],
      },
    ],
  },
];

export const assignments: Assignment[] = [
  { id: 'a1', code: 'DI', course: 'Diseño de Interfaces', title: 'Wireframes app móvil', due: 'hoy 23:59', status: 'pendiente' },
  { id: 'a2', code: 'BD', course: 'Bases de Datos', title: 'Consulta SQL avanzada', due: '12 jul', status: 'pendiente' },
  { id: 'a3', code: 'AL', course: 'Álgebra Lineal', title: 'Ejercicios tema 4', due: '15 jul', status: 'pendiente' },
  { id: 'a4', code: 'DI', course: 'Diseño de Interfaces', title: 'Investigación UX', due: '2 jul', status: 'entregado' },
  { id: 'a5', code: 'BD', course: 'Bases de Datos', title: 'Modelo entidad-relación', due: '28 jun', status: 'calificado', score: '9,2' },
];

export const submissions: Submission[] = [
  { id: 's1', student: 'Lucía Molina', initials: 'LM', title: 'Wireframes app móvil', course: 'Diseño de Interfaces', when: 'Hoy' },
  { id: 's2', student: 'Daniel Pérez', initials: 'DP', title: 'Prototipo Figma', course: 'Diseño de Interfaces', when: 'Ayer' },
  { id: 's3', student: 'Sara Gil', initials: 'SG', title: 'Investigación UX', course: 'Diseño de Interfaces', when: '2 días' },
  { id: 's4', student: 'Óscar Torres', initials: 'OT', title: 'Mapa de empatía', course: 'Diseño de Interfaces', when: '3 días' },
];

export const threads: Thread[] = [
  {
    id: 't1', code: 'DI', title: 'Dudas sobre el Sprint 2', author: 'Sara Gil', pinned: true,
    replies: [
      { author: 'Sara Gil', initials: 'SG', me: false, teacher: false, body: '¿El prototipo se entrega en Figma o en PDF exportado?', when: 'hace 2 h' },
      { author: 'Marta Ruiz', initials: 'MR', me: false, teacher: true, body: 'En Figma, compartid el enlace con permiso de comentario.', when: 'hace 1 h' },
    ],
  },
  {
    id: 't2', code: 'DI', title: 'Recursos de inspiración de layout', author: 'Daniel Pérez', pinned: false,
    replies: [
      { author: 'Daniel Pérez', initials: 'DP', me: false, teacher: false, body: 'Os dejo una colección de dashboards que me han servido de referencia.', when: 'ayer' },
    ],
  },
  {
    id: 't3', code: 'BD', title: 'Error en JOIN de tres tablas', author: 'Óscar Torres', pinned: false,
    replies: [
      { author: 'Óscar Torres', initials: 'OT', me: false, teacher: false, body: 'Me devuelve filas duplicadas, ¿alguna idea de por qué?', when: 'hace 5 h' },
    ],
  },
];

export const grades: Grade[] = [
  { course: 'Bases de Datos', item: 'Práctica 2', score: '9,2', color: '#0f766e' },
  { course: 'Diseño de Interfaces', item: 'Test tema 3', score: '8,0', color: '#2563eb' },
  { course: 'Álgebra Lineal', item: 'Parcial 1', score: '7,5', color: '#d97706' },
];

export const users: PlatformUser[] = [
  { name: 'Lucía Molina', initials: 'LM', role: 'Alumno', joined: 'Hoy' },
  { name: 'Jorge Alba', initials: 'JA', role: 'Profesor', joined: 'Ayer' },
  { name: 'Sara Gil', initials: 'SG', role: 'Alumno', joined: 'Ayer' },
  { name: 'Ana Díaz', initials: 'AD', role: 'Admin', joined: '2 días' },
  { name: 'Daniel Pérez', initials: 'DP', role: 'Alumno', joined: '3 días' },
];

export const notifications: Notification[] = [
  { id: 'n1', type: 'grade', text: 'Tu Práctica 2 de Bases de Datos ha sido calificada: 9,2', time: 'hace 1 h', read: false },
  { id: 'n2', type: 'forum', text: 'Marta Ruiz respondió en "Dudas sobre el Sprint 2"', time: 'hace 2 h', read: false },
  { id: 'n3', type: 'assignment', text: 'Nueva tarea en Diseño de Interfaces: Wireframes app móvil', time: 'hace 5 h', read: false },
  { id: 'n4', type: 'reminder', text: 'Recordatorio: "Wireframes app móvil" vence hoy', time: 'ayer', read: true },
];

export function getCourseProgress(course: Course): number {
  let total = 0;
  let done = 0;
  course.sections.forEach((s) =>
    s.lessons.forEach((l) => {
      total++;
      if (l.done) done++;
    })
  );
  return total ? Math.round((done / total) * 100) : 0;
}

export function getCourse(id: string): Course | undefined {
  return courses.find((c) => c.id === id);
}