# Bitácora

Registro de iteraciones para quien mantiene el código: **qué** cambió, **por qué**, qué
se descartó y qué salió mal por el camino. Convención en [`CLAUDE.md`](../CLAUDE.md) §7.
Las entradas nuevas van arriba. Los números de iteración solo tienen que ser únicos:
nunca se renumeran.

---

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
