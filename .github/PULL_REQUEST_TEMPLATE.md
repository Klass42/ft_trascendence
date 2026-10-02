## Tipo de cambio

- [ ] `feat` — New feature
- [ ] `fix` — Bug fix
- [ ] `refactor` — Code improvement (no feature change)
- [ ] `docs` — Documentation only
- [ ] `test` — Adding or updating tests
- [ ] `chore` — Tooling, CI, dependencies

## Descriptción

<!-- Qué hace esta PR y que issues son relevantes. -->

-
-
-

Issues que cierra: #


## Screenshots / Recordings

<!-- For UI changes: before/after screenshots or a short video. Delete if not applicable. -->

## Testeo

Antes de abrir esta PR:

- [ ] **CI local:** `make ci` termina en verde (linters, build, tests del backend).
- [ ] **Despliegue:** `make && make smoke` pasa desde cero si la PR toca `compose.yaml`, `infra/`, Dockerfiles o variables de entorno.
- [ ] **Tests:** Los tests unitarios de la lógica afectada han sido creados y pasan correctamente.

<!-- Descripción sobre como se testea este cambio (Ayuda para el revisor) -->


## Checklist

- [ ] He hecho fetch y merge/rebase de `staging` antes de pushear
- [ ] He actualizado la documentación.
- [ ] No secretos o credenciales en el código
- [ ] My PR cumple con: [Conventional Commits](https://www.conventionalcommits.org/)
