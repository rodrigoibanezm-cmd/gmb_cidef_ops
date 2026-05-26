# render-visual.md — Sodimac

## Estado

ROM visual específico para el tenant `sodimac`.

Este documento adapta el ROM neutro `ROM/render-visual.md` al contexto de Sodimac:

- homecenters;
- tiendas grandes;
- constructor;
- sucursales multiubicación;
- riesgo reputacional operativo.

Define el fondo de la representación visual, no el formato fino.

---

# Principio central

En Sodimac, la visualización debe priorizar atención operacional.

El objetivo no es explorar datos.

El objetivo es responder rápido:

- qué tienda requiere atención;
- dónde se concentra el deterioro;
- qué zona o formato está bajo presión;
- qué riesgo puede afectar percepción de marca;
- dónde actuar primero.

---

# Regla base

Por defecto, responder con texto ejecutivo.

Usar tabla, ranking, lista o gráfico solo si ayuda a decidir más rápido.

Nunca mostrar JSON crudo.

Nunca mostrar una tabla sin lectura ejecutiva.

---

# Salidas preferidas para Sodimac

## Red flags

Salida preferida:

1. lista priorizada;
2. evidencia concreta;
3. riesgo operacional;
4. acción recomendada.

Red flags no deben mostrarse como tabla plana si se pierde urgencia.

Cada alerta debe dejar claro:

- tienda o ubicación;
- nota actual;
- caída si aplica;
- volumen de reviews;
- razón de severidad;
- acción sugerida.

## Mayores bajas

Salida preferida:

- ranking compacto;
- lectura de deterioro;
- priorización por gravedad.

No basta ordenar por delta.

La gravedad debe considerar:

- caída;
- nota actual;
- volumen de reviews;
- si ya está bajo umbral crítico.

## Top / Bottom tiendas

Salida preferida:

- tabla compacta o ranking;
- conclusión ejecutiva.

Top 5 debe usarse para aprendizaje operativo.

Bottom 5 debe usarse para riesgo e intervención.

## Comparación por ubicación

Salida preferida:

- tabla compacta;
- lectura de brecha;
- conclusión de prioridad.

Ejemplo de uso:

- comparar comunas;
- comparar tiendas dentro de la misma zona;
- comparar Sodimac versus competidores de una ubicación.

## Comparación por formato o rol

Salida preferida:

- tabla compacta;
- lectura ejecutiva.

Ejemplos:

- homecenter;
- constructor;
- competidor;
- tienda propia.

## Tendencia

Salida preferida:

- gráfico simple solo si hay serie temporal suficiente;
- si no, texto ejecutivo con evidencia.

No usar gráfico si hay pocos puntos o si la señal no es confiable.

## Acción recomendada

Salida preferida:

- Diagnóstico;
- Evidencia;
- Riesgo;
- Acción.

No usar gráfico.

---

# Cuándo usar tabla

Usar tabla cuando el usuario quiere comparar varias tiendas, ubicaciones, marcas o roles.

La tabla debe ser compacta.

Columnas recomendadas:

- posición;
- tienda;
- ubicación;
- nota;
- variación;
- reviews;
- lectura breve.

No agregar columnas que no cambian la decisión.

---

# Cuándo usar ranking

Usar ranking cuando el usuario pide:

- mejores tiendas;
- peores tiendas;
- mayores bajas;
- mayores alzas;
- prioridades de intervención.

Todo ranking debe incluir una conclusión ejecutiva.

---

# Cuándo usar gráfico

Usar gráfico solo para evolución temporal o comparación visual clara.

Ejemplos válidos:

- rating promedio por fecha;
- tiendas críticas por fecha;
- tendencia de una tienda;
- evolución de una ubicación.

No usar gráfico para red flags si una lista priorizada comunica mejor la urgencia.

---

# Cuándo no usar visualización

No usar tabla ni gráfico cuando el usuario pregunta:

- qué hago;
- cuál es el riesgo;
- cuál es la prioridad;
- qué significa esto;
- dame resumen ejecutivo.

En esos casos, usar texto ejecutivo con evidencia breve.

---

# Reglas de confianza

Si una tienda tiene bajo volumen de reviews, advertir menor confianza.

Si una caída es fuerte pero el volumen es bajo, no sobredimensionar.

Si una tienda tiene mala nota pero sin caída reciente, marcar como riesgo estructural, no como deterioro reciente.

Si una tienda cae fuerte pero aún tiene buena nota, marcar como deterioro emergente, no crisis.

---

# Prohibiciones

El agente no debe:

- mostrar JSON crudo;
- convertir todo en tabla;
- usar gráficos decorativos;
- mezclar red flags con mayores bajas;
- tratar ranking como diagnóstico suficiente;
- inventar causas sin evidencia;
- calcular métricas no entregadas por backend;
- usar lenguaje técnico de backend en la salida ejecutiva.

---

# Regla final para Sodimac

La mejor salida no es la que muestra más datos.

La mejor salida es la que deja más claro dónde actuar primero.
