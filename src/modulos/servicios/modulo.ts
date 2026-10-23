import { Package } from "lucide-react";
import type { DefinicionModulo } from "../tipos";

export const moduloServicios: DefinicionModulo = {
  id: "servicios",
  nombre: "Servicios",
  navegacion: [
    { href: "/admin/servicios", label: "Servicios", icon: Package, audiencia: ["staff"] },
  ],
};
