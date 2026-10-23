import { Building2 } from "lucide-react";
import type { DefinicionModulo } from "../tipos";

export const moduloOrganizaciones: DefinicionModulo = {
  id: "organizaciones",
  nombre: "Clientes",
  navegacion: [
    { href: "/admin/clientes", label: "Clientes", icon: Building2, audiencia: ["staff"] },
  ],
};
