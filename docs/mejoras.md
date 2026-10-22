# Mejoras propuestas

Propuestas que **no son tareas todavía**: cada una dice qué la desbloquea. Cuando se
cumple el desbloqueo, pasa a [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) (o a una fase
de [PLAN.md](PLAN.md) si es grande). Las mejoras del core se siguen en el repositorio de
la plantilla; aquí solo las de Excelsior.

---

## Técnicas

### Content-Security-Policy

Una CSP estricta con nonces para scripts. Terceros conocidos de Excelsior: Supabase (API
y Storage), Stripe (`js.stripe.com`, iframes del Payment Element), Google (OAuth), Sentry
y Vercel (Speed Insights).

Cuidado heredado de la plantilla: si la CSP se deriva de `NODE_ENV`, `next start` contra
un Supabase local la aplica como producción y bloquea las llamadas al stack local; el
login falla sin ningún error visible. Hay que derivarla del destino real
(`NEXT_PUBLIC_SUPABASE_URL`).

**Desbloqueo:** la Fase 4 (Stripe es el último tercero del MVP). Obligatoria antes del
hito MVP.

### Workflows de producción: migraciones, drift y backups

Migraciones con `workflow_dispatch` en dry-run por defecto, drift contra producción en
solo lectura, y el módulo `backups` (que aquí debe cubrir Storage).

**Desbloqueo:** antes del hito MVP. Lo que se escriba aquí se propone después a la
plantilla.

### Sello de tiempo cualificado en las firmas

Añadir a cada contrato firmado un sello de tiempo de una TSA cualificada (RFC 3161), que
refuerza la fecha de la firma frente a terceros.

**Desbloqueo:** que un cliente o la asesoría lo pidan, o la primera disputa sobre una
firma.

---

## De producto

Ideas que no estaban en la definición inicial. Ordenadas por el valor que creemos que
aportan frente a su coste.

### Línea de tiempo del proyecto con aprobaciones

El cliente ve en qué fase está su proyecto (briefing → diseño → desarrollo → revisión →
lanzamiento) y **aprueba entregables** desde el portal: R3ZON sube el diseño, el cliente
aprueba o pide cambios con comentarios. Las rondas de revisión cuentan contra las que
incluye el contrato. Elimina el «¿cómo va lo mío?» y deja rastro de cada aprobación.

**Desbloqueo:** Fase 6 (proyectos con fases).

### Reunión de arranque en el onboarding

Tras el pago, el cliente reserva la llamada de kickoff en la agenda de R3ZON (Google
Calendar o Cal.com embebido), sin emails de ida y vuelta.

**Desbloqueo:** Fase 4 cerrada; decidir la herramienta de agenda.

### Bóveda de accesos cifrada

Sitio seguro para que el cliente entregue accesos (hosting, dominio, redes sociales,
Google Analytics) en vez de mandarlos por email. Cifrado en Postgres (pgcrypto con clave
en Vault, [DATABASE.md](DATABASE.md) → Producción), visible solo para el staff asignado,
cada lectura registrada en el audit log.

**Hasta que exista, el portal no recoge credenciales de ningún modo** (decisión T-07 de
[PLAN.md](PLAN.md)): ni como campo del briefing ni como documento.

**Desbloqueo:** Fase 5 cerrada. Es sensible: requiere su propia revisión de seguridad.

### Asistente de textos con IA en el briefing

A partir de unas pocas respuestas del cliente («a qué os dedicáis, a quién, qué os
diferencia») se propone un borrador de «Sobre nosotros» y de los textos de servicios, que
el cliente edita y aprueba. Ataca el elemento del briefing que más se retrasa: los
textos.

**Desbloqueo:** Fase 5 en producción y datos de qué elementos se quedan sin rellenar.

### Renovaciones y vencimientos

Dominios, hosting, certificados y licencias con su fecha de vencimiento; avisos al
cliente y a R3ZON antes de que caduquen, con renovación y pago desde el portal.

**Desbloqueo:** Fase 6 (servicios recurrentes y suscripciones).

### Informe mensual de mantenimiento

Para los planes de mantenimiento: informe automático (actualizaciones aplicadas, copias
de seguridad, disponibilidad, incidencias resueltas) que justifica la cuota y facilita la
mejora de plan.

**Desbloqueo:** Fase 6 y una fuente de datos de monitorización.

### Recordatorios de impago

Avisos escalonados de pagos pendientes (segundo pago de «señal + entrega», cuotas de
suscripción fallidas) con enlace directo al pago.

**Desbloqueo:** Fase 4 en producción con el primer pago pendiente real.

### PayPal y criptomonedas vía Stripe

Añadir PayPal y pagos en stablecoins **como métodos de Stripe**, sin integraciones
directas. Depende de que Stripe los ofrezca para la cuenta y el país de R3ZON.

**Desbloqueo:** un cliente que lo pida y disponibilidad confirmada en la cuenta de Stripe.

### Encuesta de satisfacción y reseña

Al lanzar un proyecto o cerrar un ticket: valoración rápida (NPS) y, si es alta,
invitación a dejar una reseña en Google.

**Desbloqueo:** primeros proyectos entregados por el portal.

### Programa de recomendación

El cliente invita a otra empresa; si contrata, ambos obtienen un descuento. Reutiliza las
invitaciones y los cupones de Stripe.

**Desbloqueo:** decisión comercial de R3ZON.

### App instalable (PWA)

Manifest e iconos para que el cliente «instale» el portal en el móvil, y notificaciones
push de tickets y aprobaciones.

**Desbloqueo:** uso real desde móvil medido tras el MVP.

### Base de conocimiento

Respuestas a preguntas frecuentes (cómo cambiar un texto, cómo funciona el
mantenimiento) junto a «abrir ticket», para resolver antes de abrirlo. Puede salir de
`public_docs/`.

**Desbloqueo:** Fase 7 y las primeras preguntas repetidas en tickets.

### Exportación y baja de datos (RGPD)

El responsable del cliente descarga todos los datos de su empresa (contratos, facturas,
documentos) y puede solicitar la baja, con los plazos de conservación legal aplicados.

**Desbloqueo:** antes de tener volumen de clientes; la primera solicitud real.

### Interfaz en inglés

Para clientes extranjeros (módulo `i18n` de la plantilla).

**Desbloqueo:** el primer cliente que no hable español.
