import { FileSignature } from "lucide-react";
import type { DefinicionModulo } from "../tipos";

export const moduloContrataciones: DefinicionModulo = {
  id: "contrataciones",
  nombre: "Contrataciones",
  navegacion: [
    {
      href: "/admin/contrataciones",
      label: "Contrataciones",
      icon: FileSignature,
      audiencia: ["staff"],
    },
  ],
};
