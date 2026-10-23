/** API pública (cliente y servidor) del módulo CONTRATACIONES. */
export {
  CIERRES_MANUALES,
  ESTADOS,
  ESTADOS_REVISION,
  type Estado,
  type EstadoRevision,
  ETAPAS,
  type Etapa,
  etapaEmbudo,
  type PasoAlta,
  pasoCliente,
  pasosAlta,
  puedeActivarse,
  TRANSICIONES,
} from "./estados";
