import { House } from "lucide-react";
import { project } from "@/config/project";
import type { DefinicionModulo } from "../tipos";

export const moduloInicio: DefinicionModulo = {
  id: "inicio",
  nombre: "Inicio",
  navegacion: [
    { href: project.homePath, label: "Inicio", icon: House, audiencia: ["cliente", "staff"] },
  ],
};
