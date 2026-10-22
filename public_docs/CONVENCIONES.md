# Cómo se escribe la documentación pública

Guía de redacción para quien escriba en `public_docs/`. No se publica. El contrato
técnico (frontmatter, `_meta/`, fechas) está en [`README.md`](README.md).

---

## 1. Para quién se escribe

Para una persona **no técnica** que tiene un problema concreto ahora mismo. No va a leer
de principio a fin: ha llegado buscando una cosa.

Y, cada vez más, para una **IA** que leerá la página y responderá por nosotros a alguien
que nunca la visitará. Las dos quieren lo mismo: la respuesta antes que el contexto.

## 2. Las reglas que más importan

1. **El primer párrafo responde.** Toda página empieza por `**Respuesta corta.**` y la
   respuesta entera. Un motor generativo cita las primeras 40-60 palabras: si ahí hay
   contexto, cita contexto. (Lo comprueba el validador.)
2. **Un `##` es una pregunta o una acción literal.** Nunca `## Introducción`,
   `## Consideraciones`, `## Notas` ni `## Resumen`. (También lo comprueba.)
3. **Cada página se sostiene sola.** Repetir un requisito en tres páginas no es
   duplicidad: es lo que hace correcta la respuesta cuando se lee aislada.
4. **Verifica cada dato contra el código.** En Markdown no hay compilador. Si el código
   se contradice a sí mismo, **no elijas**: anótalo como bloqueante en
   `docs/TAREAS_PENDIENTES.md` y no escribas esa página.

## 3. Estructura de una guía

```markdown
**Respuesta corta.** [Qué se hace, en dos frases, con sus requisitos.]

## Qué necesitas antes de empezar
## Cómo <hacer la cosa>, paso a paso
## Qué tener en cuenta
## Lo que no es evidente
## Preguntas frecuentes sobre <tema>
## Qué leer después
```

Se pueden omitir secciones. **No** se pueden reordenar ni renombrar: el Docusaurus
deriva el JSON-LD de esta estructura.

- **Qué necesitas** → requisitos reales, no obviedades.
- **Paso a paso** → lista **ordenada**, un acto por paso, el nombre exacto del control en
  **negrita**. Si un paso necesita subestructura, son dos pasos.
- **Qué tener en cuenta** → límites, efectos irreversibles, lo que sorprende.
- **Lo que no es evidente** → funcionalidad real que nadie encuentra solo. Suele ser la
  sección más valiosa.
- **Preguntas frecuentes** → 3-6, cada una un `###`, formuladas como las diría alguien.

## 4. Tono

En el idioma del producto, natural, sin jerga y sin marketing. Para español:

- **Tuteo.** «Abre Ajustes», no «el usuario debe abrir».
- **Presente de indicativo.** «El sistema guarda», no «guardará».
- **Frases cortas.** Si una frase necesita dos comas para respirar, son dos frases.
- **Di el porqué.** Es lo que separa una guía útil de una lista de clics.
- **Sin condescendencia.** Nada de «simplemente», «basta con» ni «solo tienes que».
- **Sin relleno.** Nada de «En este artículo veremos…».

## 5. Fechas

Si cambias un paso, el nombre de un botón o un límite, actualiza `last_update.date` en
el mismo commit. Si solo corriges una errata, no. (Contrato §8.)
