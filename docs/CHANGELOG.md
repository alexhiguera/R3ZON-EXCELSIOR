# Bitácora

Registro de iteraciones para quien mantiene el código: **qué** cambió, **por qué**, qué
se descartó y qué salió mal por el camino. Convención en [`CLAUDE.md`](../CLAUDE.md) §7.
Las entradas nuevas van arriba. Los números de iteración solo tienen que ser únicos:
nunca se renumeran.

---

### Iteración 3 — *2026-10-22* — Fase 0: identidad, marca de r3zon.com y armazón responsive

Primer bloque de código de Excelsior. El repositorio deja de ser la plantilla y la
interfaz se ve como r3zon.com en móvil, tablet y escritorio.

- **Decisiones** D-01, D-02, D-03 y D-09 cerradas con R3ZON y pasadas a T-10 a T-13:
  «R3ZON Clientes», invitación atada al email (también con Google), `admin` + `staff`,
  y usuarios en varias empresas con selector.
- **Identidad** según `TEMPLATE.md`: `project.ts`, `package.json`, `config.toml`
  (`project_id = "excelsior"`, puertos **5542x**), `.env.example`, `_meta/` e
  `index.md`. `docs:validar` y los tests de derivación pasan.
- **Marca**: tokens extraídos del CSS publicado en r3zon.com (no inventados): tinta
  `#05010f`, magenta `#e549ff` para la acción principal con su resplandor, rosa
  `#ff9ffc` para el foco, Inter y Sora vía `next/font` (servidas desde nuestro dominio).
  Logotipo e icono copiados de la web y revisados (solo trazados, sin scripts); el logo
  se genera desde el SVG original para no transcribir trazados a mano: la primera
  versión transcrita tenía erratas. **Solo modo oscuro** (T-14): la web no tiene tema
  claro y el portal es la misma marca.
- **Armazón**: navegación declarada en `src/config/navegacion.ts` (añadir un apartado es
  añadir una entrada; un test exige que cada entrada exista como página), barra lateral
  en escritorio, cabecera + barra inferior en móvil (solo con dos o más secciones),
  enlace «Saltar al contenido». Login sin «Crear cuenta», con el aviso de que las
  cuentas llegan por invitación. `Card`, `Badge` y `Stepper` con jest-axe.
- **Error propio corregido antes de probar**: `NavLinks` (cliente) recibía las entradas
  con su icono desde el servidor; un componente es una función y no cruza esa frontera.
  Ahora recibe la audiencia y lee la lista él mismo.
- **E2E en escritorio y móvil** (Pixel 7), con un solo worker: el logout llama a
  `signOut()` sin `scope`, que cierra todas las sesiones del usuario, y en paralelo un
  proyecto tumbaba la sesión del otro. Abierta la tarea de decidir el `scope`.
- **Dependencias**: `npm audit` daba 7 vulnerabilidades nuevas desde la plantilla (una
  crítica en `next` < 16.3.8). `npm audit fix` dentro de los rangos (`next` 16.4.2) y
  `vitest` + `@vitest/coverage-v8` a 5.0.5 juntos (el segundo fija la versión exacta del
  primero, por eso `audit fix` no podía). 0 vulnerabilidades; sin scripts de instalación
  nuevos sin aprobar.
- **Aplazado con motivo**: `Dialog`, `Toast`, `Tabs` y `Dropzone` se construyen en la
  fase que los use por primera vez; un componente sin pantalla se diseña a ciegas.
- **Comprobado sin cookie** (`CLAUDE.md` §10) contra el build de producción: `/`,
  `/login`, `/api/health`, `/robots.txt` e `/icon.svg` → 200; `/inicio` y `/admin` → 307
  al login.
- **Fallo de proceso**: para arrancar el servidor de prueba se cargó `.env.local` con
  `grep`, contra `CLAUDE.md` §5 (no hacía falta: Next lo lee solo). No se mostró ningún
  valor; no se repite.

### Iteración 2 — *2026-10-22* — Revisión del plan antes de desarrollar

Revisión externa del plan (Codex) aplicada antes de escribir código. Casi todo eran
contradicciones o huecos que habrían salido caros con migraciones encima.

- **Contradicciones corregidas.** La Fase 0 exigía cerrar D-01 a D-06, aunque D-04 a
  D-06 bloquean fases posteriores: ahora D-01, D-02, D-03 y D-09. `tenant_id` frente a
  `organization_id`: se fija `organization_id` en todo el proyecto (T-08). El briefing
  tenía un tipo «acceso» mientras la bóveda cifrada era una mejora futura: se quita el
  tipo y el portal no recoge credenciales hasta que exista la bóveda (T-07). Se descartó
  meter la bóveda en el MVP: es una pieza sensible con su propia revisión de seguridad
  y el MVP no la necesita.
- **Firma y facturas dejan de darse por buenas.** La firma simple propia sigue siendo la
  solución técnica, pero su suficiencia la decide la asesoría (D-10, bloquea la Fase 3);
  el plan ya no dice «suficiente». La validación fiscal de Stripe Invoicing se adelanta al
  **principio** de la Fase 4 (D-11).
- **Añadido:** prototipo de invitación + Google al empezar la Fase 1; máquinas de
  estados completas, con devoluciones, disputas, reembolsos, abonos y contratos
  sustituidos (ARCHITECTURE §20, R-06); firmante y pagador distintos de quien abre la
  invitación (D-12); ciclo de vida y retención de datos en el hito MVP (D-13); seguridad
  de ficheros (cuarentena, MIME por contenido, ZIP, EXIF); y el **Hito V**, recorrido
  vertical con un solo caso real antes de generalizar las fases 2–5 (T-09).
- **`supabase/config.toml`:** el comentario de `auto_expose_new_tables` describía el
  comportamiento antiguo. Supabase dejó de exponer las tablas nuevas sin `GRANT`
  explícito (proyectos nuevos desde 2026-05-30; los existentes, desde 2026-10-30, y el
  flag se retira). Solo se corrige el comentario: las migraciones ya conceden los grants
  de forma explícita, y fijar a mano un flag que se va a retirar podría romper el arranque
  con una CLI futura. Es core: se propone también a la plantilla.
- **Finales de línea:** comprobado que ningún fichero de `docs/` tiene CRLF en el árbol;
  `.gitattributes` ya fuerza LF al hacer commit.

### Iteración 1 — *2026-10-22* — Proyecto creado desde R3ZON Template v1.0.0

Excelsior nace de la plantilla de R3ZON (`r3zon-template.json` 1.0.0) para ser el área
de clientes de r3zon.com (`clientes.r3zon.com`). Esta iteración solo adapta la
documentación y define el producto y el plan; **el código sigue siendo el de la
plantilla** y la identidad (`project.ts`, puertos, `_meta/`) se personaliza en la Fase 0.

- Nuevos [`PRODUCTO.md`](PRODUCTO.md) (qué y por qué: problema, usuarios, glosario, flujo
  de invitación → contrato → pago → briefing, mapa de secciones, fuera de alcance) y
  [`PLAN.md`](PLAN.md) (fases 0–8, hito MVP, decisiones tomadas y abiertas, riesgos).
- Decisiones tomadas con R3ZON: sin registro público (solo invitación, con email +
  contraseña o Google); staff de R3ZON frente a usuarios de cliente; firma electrónica
  simple propia; Stripe como única pasarela con pago único o señal + entrega por
  transferencia/SEPA (recomendado) o tarjeta; facturas con Stripe y más adelante con
  ANTARES.
- Documentos de la plantilla vaciados según [TEMPLATE.md](TEMPLATE.md): bitácora, tareas,
  `auditoria.md` y `mejoras.md` (esta se rellena con las ideas de producto candidatas).
  Borrado `auditoria-template-final.md`.
- `ARCHITECTURE.md`, `AUTH.md`, `ROLES.md`, `DATABASE.md`, `MODULES.md`, `STACK.md`,
  `STRUCTURE.md`, `DEPLOYMENT.md`, `RESTAURACION.md` y `DEVELOPMENT.md` conservan lo que
  describe el core y añaden lo **previsto** para Excelsior, marcado como tal para no
  confundir plan con estado.
- Descartado por ahora: firma con proveedor externo (coste por envío; la firma simple
  basta para contratos B2B de servicios) y pasarelas distintas de Stripe (un solo
  proveedor que mantener).
