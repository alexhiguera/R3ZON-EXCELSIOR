# Auditorías de seguridad

Registro de revisiones de seguridad: qué se revisó, qué se encontró y en qué estado está
cada hallazgo. Las revisiones nuevas van **arriba**.

Formato de un hallazgo: `ID` · severidad (🔴 crítica · 🟠 alta · 🟡 media · 🟢 baja) ·
estado (**abierto** / **cerrado** en la iteración N / **aceptado** con su motivo).

Hallazgos del core heredados de la plantilla que siguen abiertos para este producto: la
**CSP** (ya en [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md)).

**Antes del hito MVP** ([PLAN.md](PLAN.md)) se hace la primera auditoría completa:
RLS de todas las tablas, políticas de Storage, invitaciones (tokens, caducidad, alta sin
invitación), firma de contratos (inmutabilidad, evidencias), webhooks de Stripe, panel
de staff y «ver como cliente».

---

_Sin auditorías todavía._

<!--
Formato de una entrada:

## Auditoría N — *YYYY-MM-DD* — Título

**Alcance.** …

**Qué se comprobó y cómo.** …

### Hallazgos

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| AN-1 | 🟠 | … | **Abierto** |

**Verificado y correcto.** …
-->
