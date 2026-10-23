import { moduloAcceso } from "./acceso/modulo";
import { moduloContrataciones } from "./contrataciones/modulo";
import { moduloInicio } from "./inicio/modulo";
import { moduloOrganizaciones } from "./organizaciones/modulo";
import { moduloServicios } from "./servicios/modulo";
import type { DefinicionModulo } from "./tipos";

/**
 * Módulos de negocio de Excelsior, en el orden en que aparecen en el menú.
 * Añadir un apartado = crear su carpeta en src/modulos/ y registrarlo aquí
 * (docs/ARCHITECTURE.md §21). tests/unit/modulos.test.ts comprueba que cada
 * carpeta está registrada y que ningún módulo usa las tripas de otro.
 */
export const MODULOS: readonly DefinicionModulo[] = [
  moduloInicio,
  moduloAcceso,
  moduloContrataciones,
  moduloOrganizaciones,
  moduloServicios,
];
