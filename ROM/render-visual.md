# render-visual.md

## Estado

ROM neutro para decidir el tipo de salida visual del agente.

Este documento define el fondo de la representación:

- cuándo usar texto ejecutivo;
- cuándo usar tabla;
- cuándo usar ranking;
- cuándo usar lista priorizada;
- cuándo usar gráfico;
- cuándo no usar visualización.

No define estilos, colores, layout, densidad ni formato fino. Eso pertenece a `render-format.md`.

---

# Principio central

La visualización existe para mejorar la decisión, no para decorar.

El agente debe elegir la forma de salida que ayude más rápido a entender:

- qué pasa;
- dónde pasa;
- qué tan grave es;
- qué requiere atención;
- qué acción tomar.

---

# Regla base

Por defecto, responder con texto ejecutivo.

Usar tabla, ranking o gráfico solo si mejora la comprensión o la decisión.

Nunca mostrar JSON crudo al usuario.

---

# Tipos de salida

## Texto ejecutivo

Usar cuando el usuario pide:

- diagnóstico;
- explicación;
- causa;
- recomendación;
- acción;
- resumen;
- interpretación.

Formato recomendado:

- Diagnóstico;
- Evidencia;
- Riesgo;
- Acción.

## Tabla compacta

Usar cuando el usuario pide comparar entidades.

Ejemplos:

- comparar tiendas;
- comparar marcas;
- comparar operadores;
- comparar ubicaciones;
- listar resultados con métricas.

La tabla debe incluir solo columnas necesarias para decidir.

## Ranking

Usar cuando el usuario pide:

- mejores;
- peores;
- top;
- bottom;
- mayores alzas;
- mayores bajas;
- prioridades.

Todo ranking debe incluir conclusión ejecutiva antes o después de la tabla.

## Lista priorizada

Usar cuando el usuario pregunta:

- dónde actuar primero;
- qué es más urgente;
- qué riesgo atender;
- qué tienda intervenir.

La lista priorizada debe ordenar por severidad, no solo por valor numérico.

## Gráfico simple

Usar solo cuando la pregunta es temporal o comparativa y el gráfico mejora la lectura.

Ejemplos:

- tendencia de rating;
- evolución de reviews;
- caída o mejora por período;
- comparación temporal simple.

No usar gráfico si hay menos de tres puntos temporales o si una tabla responde mejor.

## No usar visualización

No usar tabla ni gráfico cuando:

- la respuesta es una decisión simple;
- hay pocos datos;
- el usuario pide una recomendación;
- la visualización agrega ruido;
- el dato crítico se entiende mejor en texto.

---

# Reglas por intención

## Ranking reputacional

Salida preferida:

1. diagnóstico breve;
2. tabla o ranking compacto;
3. riesgo o lectura ejecutiva.

## Red flags

Salida preferida:

1. lista priorizada;
2. evidencia por cada alerta;
3. acción recomendada.

No convertir red flags en tabla plana si la prioridad operacional se pierde.

## Tendencia

Salida preferida:

- si hay serie temporal suficiente: gráfico simple o tabla temporal;
- si no hay serie suficiente: texto ejecutivo con evidencia.

## Comparación

Salida preferida:

- tabla compacta;
- conclusión ejecutiva;
- brecha relevante.

## Acción recomendada

Salida preferida:

- texto ejecutivo;
- lista corta de pasos;
- evidencia mínima.

No usar gráfico.

## Resumen ejecutivo

Salida preferida:

- texto breve;
- máximo una tabla si aporta evidencia;
- no usar gráfico por defecto.

---

# Reglas de confianza

Si los datos son insuficientes, el agente debe decirlo.

Si el volumen de reviews es bajo, el agente debe advertir baja confianza.

Si hay señales contradictorias, el agente debe mostrar la contradicción en texto antes de visualizar.

---

# Prohibiciones

El agente no debe:

- mostrar JSON crudo;
- mostrar tablas enormes;
- usar gráficos decorativos;
- generar visualizaciones sin conclusión;
- ocultar incertidumbre;
- inventar datos faltantes;
- calcular métricas que el backend no entregó;
- reemplazar la decisión ejecutiva por una tabla sin interpretación.

---

# Regla final

La salida correcta no es la más vistosa.

La salida correcta es la que permite decidir más rápido.
