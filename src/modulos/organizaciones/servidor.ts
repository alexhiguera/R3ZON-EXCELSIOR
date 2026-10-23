/** API de servidor del módulo ORGANIZACIONES (solo Server Components y Actions). */
export { archivarCliente, crearCliente } from "./acciones";
export {
  type Actividad,
  actividad,
  type Cliente,
  type ClienteResumen,
  cliente,
  directorio,
  type Empresa,
  type FiltroClientes,
  listarClientes,
  misEmpresas,
  type Persona,
  type RolEmpresa,
  registrarVistaCliente,
  rolEnEmpresa,
} from "./consultas";
export {
  type DatosFiscales,
  datosFiscales,
  guardarDatosFiscales,
  leerDatosFiscales,
} from "./fiscales";
