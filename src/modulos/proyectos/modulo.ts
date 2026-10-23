import { FolderKanban } from "lucide-react";
import type { DefinicionModulo } from "../tipos";

export const moduloProyectos: DefinicionModulo = {
  id: "proyectos",
  nombre: "Proyectos",
  navegacion: [
    { href: "/proyectos", label: "Proyectos", icon: FolderKanban, audiencia: ["cliente"] },
    { href: "/admin/proyectos", label: "Proyectos", icon: FolderKanban, audiencia: ["staff"] },
  ],
};
