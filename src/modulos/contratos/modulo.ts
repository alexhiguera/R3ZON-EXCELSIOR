import { ScrollText } from "lucide-react";
import type { DefinicionModulo } from "../tipos";

export const moduloContratos: DefinicionModulo = {
  id: "contratos",
  nombre: "Contratos",
  navegacion: [
    { href: "/admin/contratos", label: "Contratos", icon: ScrollText, audiencia: ["staff"] },
  ],
};
