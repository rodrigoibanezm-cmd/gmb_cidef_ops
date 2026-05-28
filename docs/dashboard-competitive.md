# Principios — Presión competitiva

## Estado

```txt
wish list / hipótesis de producto
```

Este documento no cierra contrato técnico, JSON final ni implementación.

Su objetivo es dejar principios y reglas para una futura superficie llamada:

```txt
Presión competitiva
```

## Definición

```txt
Presión competitiva expone movimientos del mercado que requieren reacción antes de volverse posición.
```

No nace para describir competidores.

Nace para mostrar dónde la percepción de mercado se está moviendo y dónde conviene intervenir temprano.

## Principios

### 1. La pantalla expone desplazamiento perceptual accionable

La unidad principal no es el competidor.

La unidad principal es el movimiento perceptual que puede afectar preferencia, confianza o diferenciación.

### 2. La presión competitiva se entiende como movimiento

La pantalla debe mostrar algo que está cambiando.

No busca mostrar estado, ranking ni foto estática.

### 3. La card comprime tensión para decidir

Cada card debe ayudar a entender rápidamente:

```txt
qué está cambiando
por qué importa
qué riesgo genera
qué acción inicial tomar
```

### 4. La acción aparece antes que el análisis

La lectura debe empujar intervención.

El usuario no debería terminar pensando “tengo que analizar esto”, sino “tengo que actuar acá”.

### 5. La evidencia sostiene confianza sin dominar la lectura

La evidencia debe estar disponible y ser concreta.

Pero no debe convertirse en el centro de la pantalla.

### 6. El agente entrega profundidad cuando el usuario la pide

La card no intenta explicar todo.

```txt
Card = compresión para decidir.
Agente = profundidad para entender.
```

Cada card debe tener bajada directa al agente.

### 7. Misma carcasa, distinta fuente de presión

Presión competitiva debe sentirse como parte del mismo sistema que Presión operacional.

```txt
misma interacción
misma lógica de cards
misma compresión ejecutiva
misma bajada al agente
```

Cambia el origen de la presión:

```txt
Presión operacional = dónde intervenir mi operación.
Presión competitiva = dónde me están desplazando en percepción de mercado.
```

### 8. El lenguaje debe sonar contextual, no genérico

Cada card debe parecer nacida de una señal real.

Debe evitar sonar como plantilla repetida.

## Reglas

```txt
1. Sin rankings visibles.
2. Sin charts.
3. Sin tablas comparativas.
4. Sin métricas protagonistas.
5. Sin lenguaje consultora.
6. Sin clasificación en frontend.
7. Sin sobreinterpretar señales débiles.
8. Sin convertir todas las cards en la misma frase con distinto nombre.
```

## Claim tentativo

```txt
NexusG · Presión competitiva
```

Bajada tentativa:

```txt
Movimientos del mercado que requieren reacción antes de volverse posición.
```

## Categorías tentativas

```txt
Erosión
Momentum rival
Atributo en disputa
Presión emergente
```

Estas categorías son lenguaje de producto, no contrato técnico cerrado.

## Valor esperado

La capa debería permitir detectar temprano:

```txt
ventaja erosionándose
competidor ganando momentum
atributo dejando de pertenecer claramente a la marca
presión emergente en una zona o experiencia
```

El valor no está en saber quién gana.

El valor está en saber:

```txt
dónde reaccionar antes de que la percepción se consolide
```

## Fuera de alcance por ahora

```txt
JSON final
endpoint final
modelo de scoring
reglas de clasificación
SQL/materialización
cambios de frontend
charts
rankings visibles
tablas comparativas
```

## Criterio de avance

Avanzar recién cuando exista claridad suficiente sobre:

```txt
qué señales competitivas reales tenemos
qué presión se puede afirmar sin sobreinterpretar
qué evidencia mínima sostiene cada card
qué acción puede sugerirse sin sonar genérica
```
