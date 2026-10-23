# Producto: Excelsior — área de clientes de R3ZON

**Excelsior** es el nombre interno del proyecto. Para el cliente es el **área de clientes
de R3ZON** y vive en **`clientes.r3zon.com`**: la parte privada de la web de r3zon.com.

Este documento dice **qué** se construye y **por qué**. El **cuándo** y en qué orden está
en [PLAN.md](PLAN.md); el **cómo** técnico, en [ARCHITECTURE.md](ARCHITECTURE.md).

> Estado: **definición** (2026-10-22). Nada de lo descrito aquí está implementado todavía;
> el repositorio es aún la plantilla sin personalizar.

---

## 1. El problema

Hoy, cuando un cliente contrata (p. ej. una web o un ecommerce), R3ZON le envía por
separado:

- un documento en forma de lista con todo lo que necesitamos para empezar;
- el contrato para firmar;
- las instrucciones de pago.

Son tres canales sin estado común. Para R3ZON es caótico (¿qué ha enviado ya?, ¿firmó?,
¿pagó?, ¿dónde está el logo?) y para el cliente es fricción justo en el momento en que
acaba de decidir confiar en nosotros.

## 2. La propuesta

Un único sitio, con la estética de r3zon.com, donde el cliente:

1. entra **solo por invitación**, con el servicio ya elegido por R3ZON;
2. recorre un **onboarding guiado** que le agradece la elección y le explica qué viene;
3. da **solo los datos necesarios** para generar contrato y factura;
4. **revisa y firma** el contrato ahí mismo;
5. **paga** con la modalidad que prefiera (Stripe);
6. recibe la **confirmación** y la copia del contrato y la factura por email;
7. aporta los **materiales del proyecto** (logo, colores, tipografías, imágenes, textos,
   datos legales…) en una zona tipo Google Drive, **ahora o más adelante**.

Y después, ese mismo sitio es donde vive la relación: servicios contratados, contratos,
propuestas y presupuestos, mejoras de plan, tickets y documentos de cada proyecto.

## 3. Quién lo usa

| Persona | Quién es | Qué ve |
|---|---|---|
| **Equipo R3ZON** (staff) | Trabajadores de R3ZON | Panel de administración: todos los clientes, servicios, invitaciones, contratos, pagos, tickets |
| **Usuario cliente** | Trabajador de una empresa cliente | Solo la información de **su** empresa: sus servicios, proyectos, contratos, facturas, documentos y tickets |
| **Anónimo** | Cualquiera | Login, aceptación de invitación y páginas legales. **No puede crear cuenta** |

Dentro de una empresa cliente puede haber varias personas (el gerente que firma, quien
lleva marketing, quien lleva facturación). El modelo de permisos está en
[ROLES.md](ROLES.md).

## 4. Principios de producto

- **Solo clientes.** No hay registro público. Una cuenta nace siempre de una invitación
  de R3ZON (o, más adelante, de un compañero de su empresa).
- **Fricción mínima.** Cada pantalla pide lo justo para el paso siguiente. Lo que no
  bloquea el contrato o el pago se puede dejar **para luego**, y el portal lo recuerda.
- **Guardar y seguir.** Todo formulario largo se guarda solo; cerrar el navegador no
  pierde nada.
- **Estética r3zon.com.** Misma marca, tipografía, colores y tono. **Responsive de
  verdad**: móvil y tablet son ciudadanos de primera (mucho cliente firmará desde el
  móvil).
- **Un dato, un sitio.** Lo que el cliente ya dio (razón social, NIF, dirección) no se le
  vuelve a pedir: contrato, factura y textos legales lo reutilizan.
- **Crecer por apartados.** Las necesidades nuevas entran como secciones nuevas, sin
  rehacer lo anterior (ver [ARCHITECTURE.md](ARCHITECTURE.md) §15).

## 5. Glosario

Términos del dominio. El código usa estos nombres (ver
[STRUCTURE.md](STRUCTURE.md) → Convención de nombres).

| Término | Significado |
|---|---|
| **Cliente** (organización) | Empresa (o autónomo) que contrata a R3ZON. Agrupa usuarios, proyectos, contratos y facturas |
| **Usuario** | Persona con cuenta. Pertenece a R3ZON (staff) o a un cliente |
| **Servicio** | Tipo de cosa que R3ZON vende: web corporativa, ecommerce, mantenimiento, SEO… Define su onboarding, su briefing, su plantilla de contrato y sus precios |
| **Contratación** | Un servicio concreto contratado por un cliente, con su precio, modalidad de pago y dos estados independientes: el **contractual** (invitada → datos → firmada → activa) y el **económico** (no pagado, parcialmente pagado, pagado, pendiente de revisión) |
| **Proyecto** | El trabajo que nace de una contratación (la web de la empresa X). Tiene briefing, documentos y tickets |
| **Invitación** | Enlace de un solo uso que genera R3ZON para que alguien cree su cuenta, ya vinculado a un cliente y, la primera vez, a un servicio |
| **Onboarding** | Recorrido guiado tras aceptar la invitación: bienvenida → datos → contrato → pago → confirmación → briefing |
| **Briefing** | Lista de materiales e información que el cliente debe aportar para su proyecto (logo, colores, textos, imágenes…). Nunca contraseñas |
| **Propuesta / presupuesto** | Oferta de R3ZON al cliente, que este acepta y que desemboca en una contratación (firma + pago) |
| **Plan** | Nivel de un servicio recurrente (mantenimiento básico, pro…). Se puede mejorar |
| **Ticket** | Incidencia o petición del cliente sobre un proyecto o servicio |

## 6. El flujo estrella: de invitación a proyecto en marcha

Ejemplo: un cliente nuevo contrata una web corporativa.

```text
R3ZON (panel)                         Cliente
─────────────                         ───────
1. Crea el cliente (o solo su email)
2. Elige servicio: «Web corporativa»,
   precio y condiciones
3. Genera la invitación ──── email ──► 4. Abre el enlace
                                       5. Crea cuenta: email + contraseña  ó  Google
                                       6. Bienvenida: «Gracias por elegirnos» +
                                          qué incluye su servicio y qué pasará ahora
                                       7. Datos para contrato y factura
                                          (razón social, NIF, dirección, firmante)
                                       8. Modalidad de pago (la fija R3ZON, T-31): pago único
                                          o señal + entrega, por transferencia/SEPA o tarjeta
                                       9. Previsualiza el contrato → lo firma
                                      10. Paga (Stripe)
                                      11. Enhorabuena: copia del contrato y factura
                                          por email
                                      12. Briefing: logo, isotipo, colores, tipografías,
                                          imágenes, textos… (ahora o más tarde)
                                      13. Datos legales pendientes para textos legales
R3ZON recibe aviso en cada paso ◄──── 14. Proyecto en marcha
```

Detalles que el diseño tiene que resolver (ver [PLAN.md](PLAN.md) → Fase 3 y 4):

- **No todos los clientes recorren todos los pasos** (T-27): el equipo decide por
  contratación si el cliente firma y si paga en el portal (hay clientes que ya pagaron o
  firmaron fuera). Los cobros de fuera los registra el equipo; el estado económico es
  independiente del contrato (T-26).
- **El pago por transferencia o SEPA no es inmediato** (días). El paso 11 tiene dos
  variantes: «pago recibido» y «pago en curso: te avisaremos». El proyecto puede
  arrancar con el contrato firmado y el pago en curso si R3ZON lo decide.
- **Señal + entrega**: se cobra la señal en el onboarding; el resto se cobra cuando R3ZON
  marque la entrega (el cliente recibe aviso y paga desde el portal).
- **Abandonar a mitad**: el onboarding se retoma donde se dejó, y R3ZON ve en qué paso
  está cada cliente.

## 7. Mapa de secciones

### Para el cliente

| Sección | Qué hace |
|---|---|
| **Inicio** | Estado de un vistazo: pasos pendientes (firmar, pagar, aportar materiales), avisos, últimos movimientos |
| **Servicios** | Lo contratado, su estado y su plan. Botón de **mejorar plan** |
| **Proyectos** | Cada proyecto con su fase, briefing y progreso |
| **Documentos** | Zona tipo Drive por proyecto: carpetas, subida por arrastre, vista previa |
| **Contratos** | Contratos firmados y pendientes de firma, con descarga |
| **Propuestas** | Presupuestos recibidos: ver, aceptar (→ firma + pago) o rechazar |
| **Facturas y pagos** | Facturas, pagos pendientes, método de pago |
| **Soporte** | Tickets: abrir, seguir, responder |
| **Mi empresa** | Datos fiscales, usuarios de la empresa |
| **Mi cuenta** | Perfil, contraseña, Google vinculado, sesiones |

### Para R3ZON (panel de administración)

| Sección | Qué hace |
|---|---|
| **Panel** | Embudo de onboarding (en qué paso está cada cliente), cobros pendientes, tickets abiertos |
| **Clientes** | Alta manual, ficha completa, usuarios, actividad. Ver el portal **como** ese cliente |
| **Invitaciones** | Generar enlace con servicio preseleccionado, reenviar, revocar, caducidad |
| **Servicios** | Catálogo: precios, modalidades, plantilla de contrato, pasos de onboarding y briefing |
| **Contratos y propuestas** | Plantillas versionadas, envío, estado de firma |
| **Pagos y facturas** | Estado en Stripe, reconciliación |
| **Tickets** | Bandeja común, asignación, prioridades |

## 8. Fuera de alcance (por ahora)

Quién puede reabrirlo: el responsable de producto de R3ZON (ver `CLAUDE.md` §0).

- **Registro público** de cuentas.
- **Pasarelas distintas de Stripe.** PayPal y criptomonedas se valorarán **a través de
  Stripe** si está disponible para la cuenta; ninguna integración directa
  ([mejoras.md](mejoras.md)).
- **Emitir facturas desde el portal.** La factura (TicketBAI) la emite **ANTARES**, el
  producto de facturación de R3ZON; el portal solo guarda y muestra su referencia (T-29,
  [PLAN.md](PLAN.md) → Fase 8).
- **Pago en efectivo** (T-28).
- **Firma electrónica avanzada o cualificada.** Se usa firma electrónica simple propia
  con evidencias ([ARCHITECTURE.md](ARCHITECTURE.md) §17).
- **App nativa.** El portal es web responsive (y quizá PWA).
- **Varios idiomas.** Solo español al principio.
