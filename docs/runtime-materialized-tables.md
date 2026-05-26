# Runtime materializado en Neon

## Estado

Documento de arquitectura para el uso de tablas materializadas en Neon como insumo principal del runtime, del frontend y del agente.

---

## Decisión

El runtime no debe reconstruir la foto operacional desde tablas crudas en cada consulta.

La carga operativa debe dejar preparadas tablas materializadas en Neon.

El frontend y el agente deben leer primero esas tablas.

Solo deben bajar al detalle cuando el usuario pide causa, evidencia o reviews.

---

## Principio central

La carga calcula.

El runtime lee.

El agente interpreta.

El frontend prioriza visualmente.

---

## Flujo correcto

1. Captura o actualización desde Google Places.
2. Persistencia de raw, snapshots, métricas y reviews en Neon.
3. Rebuild de tablas materializadas.
4. Frontend lee la foto materializada.
5. Custom GPT lee la misma foto materializada vía backend.
6. Solo si hace falta evidencia, el agente consulta detalles o reviews.

---

## Qué problema resuelve

Evita que cada consulta vuelva a recorrer toda la información.

Reduce:

- tiempo de respuesta;
- costo de procesamiento;
- queries pesadas;
- errores por cálculo repetido;
- inconsistencias entre front y agente;
- dependencia del LLM para ordenar datos.

---

## Regla de runtime

Primera fuente del runtime:

- tablas materializadas de dashboard;
- rankings diarios;
- red flags diarios;
- movimientos diarios;
- resumen operacional diario.

Fuente secundaria:

- snapshots;
- métricas históricas;
- reviews;
- evidencia.

La fuente secundaria se usa solo para explicar, auditar o profundizar.

---

## Tablas sugeridas

### dashboard_summary_daily

Foto ejecutiva del tenant por fecha.

Debe alimentar:

- KPI principal;
- nota promedio;
- tendencia;
- reviews;
- tiendas críticas;
- headline táctico;
- fecha de actualización.

### dashboard_redflags_daily

Riesgos activos por tenant y fecha.

Debe alimentar:

- red flags;
- alertas mobile;
- prioridades de atención;
- preguntas del agente sobre riesgo.

Red flags representan riesgo actual o estructural.

No son necesariamente lo mismo que mayores bajas.

### dashboard_movements_daily

Movimientos relevantes por tenant y fecha.

Debe alimentar:

- mayores alzas;
- mayores bajas;
- deterioro reciente;
- recuperación reciente.

Movements.down representa caída reciente.

No es equivalente a red_flags.

### dashboard_rankings_daily

Rankings por tenant y fecha.

Debe alimentar:

- Top 5;
- Bottom 5;
- rankings por tienda;
- rankings por ubicación o rol si aplica.

### review_evidence_index

Índice para bajar a evidencia cuando el usuario pregunta por causas.

Debe alimentar:

- reviews relevantes;
- ejemplos;
- citas operacionales;
- señales semánticas.

No se debe leer por defecto en cada render del dashboard.

### dashboard_windows

Tabla futura para ventanas o hallazgos guardados.

Debe almacenar análisis fijados por el agente o por usuarios.

No es fuente de verdad principal.

---

## Frontend

El frontend debe leer la foto materializada desde un endpoint único.

Endpoint MVP:

/api/dashboard?tenant_id={tenant_id}&view=full

El frontend no debe calcular inteligencia.

El frontend puede ordenar visualmente, renderizar y esconder secciones según tamaño de pantalla.

No debe reconstruir rankings, red flags ni tendencias desde raw data.

---

## Custom GPT

El Custom GPT debe consultar primero la foto materializada.

Debe usar esa foto para responder preguntas como:

- estado actual;
- red flags;
- tiendas críticas;
- mayores bajas;
- top/bottom;
- resumen ejecutivo;
- dónde actuar primero.

Solo debe consultar evidencia o reviews cuando el usuario pide:

- por qué;
- causa;
- evidencia;
- ejemplos;
- qué reviews explican esto;
- auditoría del resultado.

---

## Separación de responsabilidades

Backend:

- calcula;
- materializa;
- valida tenant;
- expone contratos estables.

Neon:

- almacena raw;
- almacena snapshots;
- almacena tablas materializadas;
- guarda evidencia.

Frontend:

- renderiza;
- prioriza visualmente;
- adapta desktop/mobile;
- no calcula inteligencia.

Custom GPT:

- interpreta;
- explica;
- contextualiza;
- recomienda;
- no recalcula la operación completa.

---

## Regla de carga

Toda carga relevante debe terminar con rebuild de tablas materializadas.

Ejemplo lógico:

1. full-neon actualiza snapshots, métricas y reviews.
2. rebuild_dashboard_tables recalcula summary, red flags, movements y rankings.
3. dashboard y agente quedan leyendo la misma foto.

Si el rebuild falla, la respuesta de carga debe exponerlo.

No debe quedar invisible.

---

## Regla de fecha

Toda tabla materializada debe tener:

- tenant_id;
- date;
- updated_at;
- source_run_id si existe;
- status si aplica.

Esto permite auditar qué foto está viendo el front y qué foto está usando el agente.

---

## Regla de verdad

Raw y snapshots son la verdad base.

Tablas materializadas son verdad operacional preparada.

Frontend y agente deben tratar las materializadas como insumo principal para runtime.

Si hay discrepancia, se audita desde raw/snapshots, pero no se recalcula improvisadamente en el front ni en el LLM.

---

## Ventanas guardadas

Las ventanas guardadas son artefactos de análisis.

No reemplazan el dashboard base.

No reemplazan las tablas materializadas.

Pueden representar:

- ranking guardado;
- tabla guardada;
- resumen ejecutivo;
- alerta especial;
- hipótesis;
- recomendación.

Deben tener fecha, fuente y estado.

---

## Prohibiciones

No hacer:

- cálculos críticos en el frontend;
- rankings on-run desde raw data;
- red flags generados por el LLM sin backend;
- lectura completa de reviews por defecto;
- reconstrucción completa en cada pregunta;
- tablas materializadas sin fecha;
- respuestas del agente basadas en memoria.

---

## Regla final

Neon debe funcionar como memoria operacional preparada.

El runtime no debe partir desde cero.

El producto gana velocidad, estabilidad y coherencia cuando frontend y agente leen la misma foto materializada.
