# Tareas unificadas — guía de equipo

> **Estado:** landed 2026-09-19 (pretests + finaltests verdes).
> Dueño: David (Interaction). Schema lo absorbe David. Jorge revisa Identity/RBAC/tenancy.
> Decisión: spec **Accepted** [`docs/superpowers/specs/2026-09-19-task-templates-design.md`](../superpowers/specs/2026-09-19-task-templates-design.md).
> Plan: [`docs/superpowers/plans/2026-09-19-task-templates.md`](../superpowers/plans/2026-09-19-task-templates.md).
> Copy UI: [`ui-language.md`](./ui-language.md).

Este archivo es cómo trabajar con el ciclo unificado. **No** duplica el spec.

## Tres objetos (no mezclar)

| Producto | Persistencia | Qué es |
|---|---|---|
| Tarea | `Activity` + `Question[]` | Instancia en un curso (bloques, ventana, notas) |
| Plantilla | `TaskTemplate.blocks` (JSON) | Receta reutilizable, sin alumnos |
| Nota | `Attempt` / `Answer` | Fuente de verdad; el promedio es una vista |

**No hay modelo `Task`.** El copy es «Tarea»; el código y Prisma siguen en `activities/`.

Plantilla ≠ instancia ≠ intento. Instanciar o duplicar copia bloques y puntos; **no** copia intentos, notas, fechas ni `countsTowardFinal` (la nueva nace en `true`).

## Cómo — profesor

Tres entradas al mismo editor (`ActivitiesPage`, nav **Tareas** → `/activities`; `/assignments` redirige):

1. En blanco: `POST /courses/:courseId/activities` + bloques `POST .../questions`.
2. Desde plantilla: el mismo POST con `templateId`. Biblioteca → pestaña **Plantillas**.
3. Desde anterior: POST con `sourceActivityId`. Biblioteca → **Anteriores** (`GET /me/teaching/activities`).

`templateId` y `sourceActivityId` juntos → 400. Otra org → 404.

- **Guardar como plantilla:** `POST /activities/:id/save-as-template`. Snapshot de `Question[]`. Borrar la receta no toca instancias.
- **Cuenta para la nota final:** switch en la **instancia** (`countsTowardFinal`, default `true`). No vive en la plantilla. Práctica: el alumno ve score; `final` del curso no la usa.
- **Publicar** con cero bloques / `maxScore === 0` → 400. `maxScore` lo escribe el servicio (`sum(Question.points)`); el cliente no manda uno efectivo.
- Con intentos existentes: mutar bloques → 409; título/fechas/flag/status sí. `DELETE` con intentos → 409 (archivar).

Bloques v1: los 6 objetivos (MCQ, V/F, huecos, emparejar, ordenar, corta) + `ESSAY` + `FILE_UPLOAD` (manual). Fuera: `LISTENING`/`SPEAKING`, pesos, rúbricas. Añadir un tipo = un adaptador en `activities/blocks/` + editor/player.

## Cómo — alumno

`GET /courses/:courseId/activities` (solo `PUBLISHED`, sin claves). Ciclo: start → save answers → submit.

- Objetivos se corrigen al enviar. Si queda subjetivo → `SUBMITTED` hasta `PATCH /attempts/:id/grade`.
- Todos `awarded` → `GRADED`, `score = sum(awarded)`, `GRADE_PUBLISHED`.
- Fuera de ventana o `attemptsAllowed` excedido → 400.
- Vacío de notas: `GET /courses/:id/grades/me` → **200** `{ items: [], final: null }` (nunca 404 por vacío).

## Cómo — calificar y promedio

Cola staff: intentos `SUBMITTED`. Body de grade: `{ answers: [{ questionId, awarded }], feedback? }` — el `{ score }` plano ya no se acepta.

`GET /courses/:id/gradebook` y `grades/me` y el CSV leen **actividades + intentos** (`items` + `final`). Fórmula (`computeFinalGrade`):

- Ítems: `PUBLISHED`/`ARCHIVED` con `countsTowardFinal` y `maxScore > 0` (`DRAFT` no).
- Por ítem: mejor `score` **GRADED**; si no hay y ya cerró (`closeAt`, o `dueAt` si no hay `closeAt`) → 0; si no ha cerrado → omitir.
- `final` = media de esos ratios, o `null` si el conjunto está vacío.

Toggle del flag recalcula la vista; **no** borra filas `Attempt`.

CSV: una columna por ítem (práctica con sufijo ` (práctica)`), última `Nota final`.

## Assignment (corte)

Mutaciones → **410 Gone**. GET puede quedar para debug. Tablas `Assignment*` **no** se dropean en esta entrega.

| 410 | GET sigue |
|---|---|
| `POST/PATCH/DELETE` assignments, `DELETE .../files/:fileId` | `GET /courses/:id/assignments`, `GET /assignments/:id` |
| `POST /assignments/:id/submissions` | list/me de submissions |
| `PATCH /submissions/:id/grade` | — |

Migración idempotente (una vez; **no** en el seed rutinario):

```bash
pnpm --filter backend exec tsx prisma/migrate-assignments-to-activities.ts
```

Mapper puro: `apps/backend/src/activities/migration/assignment-mapper.ts`. Marca: `Activity.config.migratedFromAssignmentId`. Cada assignment → `Activity` con `ESSAY` (y `FILE_UPLOAD` si había ficheros de alumno).

## Dónde está el código

- Backend: `apps/backend/src/activities/` (bloques, templates, attempts, mapper). Gradebook: `assignments/grading/` (`final-grade.ts`).
- Frontend: `features/activities/` (`TaskLibrary`, form, player). Gradebook: `features/gradebook/`, `features/grades/`.
- E2E: `apps/frontend/e2e/tasks.spec.ts`.

Tenancy: `organizationId` del curso/usuario autenticado, nunca del cliente. Cross-org → 404. Staff = `STAFF_ROLES` de siempre.
