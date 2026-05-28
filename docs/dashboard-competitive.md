# Pitch — Presión competitiva

## Estado

```txt
wish list / hipótesis de producto
```

Este documento no cierra contrato técnico ni JSON final.

Su objetivo es dejar registrada la intención de producto para una futura capa de dashboard basada en presión competitiva.

## Problema

Hoy el sistema ya captura información de competencia en GMB.

El riesgo es exponer esa información como dashboard tradicional:

```txt
rankings
benchmarks
tablas
gráficos
market share
competidor #1
```

Eso volvería a poner al usuario en modo analista.

## Propuesta

Crear una nueva superficie llamada:

```txt
Presión competitiva
```

No debe describir competencia.
No debe reportar métricas.
No debe mostrar BI.

Debe exponer:

```txt
desplazamientos perceptuales accionables
```

Definición base:

```txt
Presión competitiva no informa sobre competidores.
Expone movimientos del mercado que requieren reacción antes de volverse posición.
```

## Principio de diseño

Misma carcasa que Presión operacional.

```txt
misma interacción
misma lógica de cards
misma bajada al agente
misma compresión ejecutiva
```

Cambia el origen de la presión:

```txt
Presión operacional = dónde intervenir mi operación.
Presión competitiva = dónde me están desplazando en percepción de mercado.
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

## Qué debería mostrar una card

Una card debería comprimir:

```txt
qué presión existe
por qué importa
qué riesgo genera
qué hacer
```

La evidencia debe existir, pero no ser protagonista.

Regla:

```txt
evidencia mínima, expandible, suficiente para no parecer inventado
```

## Relación con el agente

La pantalla no debe intentar explicarlo todo.

```txt
Card = compresión para decidir.
Agente = profundidad para entender.
```

Cada tarjeta debe tener bajada directa al agente.

El prompt enviado al agente puede ser más rico que el texto visible.

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

## Riesgos a cuidar

```txt
1. Convertir presión en plantilla genérica.
2. Usar lenguaje consultora.
3. Sobreinterpretar señales débiles.
4. Mostrar métricas como protagonista.
5. Hacer que el frontend clasifique o agrupe.
6. Hacer que todas las cards suenen iguales.
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
