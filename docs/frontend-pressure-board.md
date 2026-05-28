# Frontend Pressure Board

## Estado

`/dashboard` ya no debe entenderse como un dashboard KPI clásico.

La vista actual es una **superficie operacional de presión**:

- muestra señales activas
- prioriza decisiones
- comprime tensión operacional
- evita exploración analítica
- evita lógica de negocio en frontend

## Ruta

```txt
/dashboard/?tenant_id=beauty_plus
```

Consume:

```txt
/api/dashboard?tenant_id=beauty_plus&view=operational
```

## Invariante principal

```txt
Neon decide.
API transporta.
Frontend renderiza.
```

El frontend no debe calcular prioridades, severidad, rankings, métricas ni decisiones.

## Contrato visual

La pantalla debe sentirse como:

- superficie operacional
- mapa de presión
- briefing táctico
- sistema interno ejecutivo

No debe sentirse como:

- dashboard
- KPI grid
- kanban
- feed
- SaaS analytics
- observability tool
- cybersecurity UI

## Límite de señales

Máximo visible:

```txt
12 señales activas
```

Distribución conceptual:

```txt
Urgente hoy: 3 señales dominantes
Pressure field: 9 señales restantes
```

Si existen más señales, el motor debe comprimirlas antes de llegar al frontend.

## Archivos activos

```txt
public/dashboard/index.html
public/dashboard/app.js
public/dashboard/operational-pressure.js
public/dashboard/pressure-board.css
public/dashboard/config.js
```

### `app.js`

Responsabilidad única:

- leer `tenant_id`
- llamar `/api/dashboard?view=operational`
- manejar error mínimo
- llamar al renderer

No debe crecer con lógica de render.

### `operational-pressure.js`

Responsabilidad:

- renderizar la superficie operacional
- separar urgentes del pressure field
- manejar una sola señal expandida
- construir CTA contextual al agente

### `pressure-board.css`

Responsabilidad:

- layout visual del pressure board
- densidad
- temperatura visual
- superficie continua
- comportamiento responsive

## Archivos legacy

Estos archivos pertenecen al dashboard anterior y no deben volver a importarse en `/dashboard` sin decisión explícita:

```txt
public/dashboard/styles.css
public/dashboard/components.css
public/dashboard/components.js
public/dashboard/utils.js
```

No eliminarlos todavía si pueden servir como referencia o fallback, pero no mezclarlos con el pressure board.

## Reglas de diseño

### Collapsed

Una señal colapsada debe mostrar solo:

- icono mínimo
- headline dominante
- indicador visual sutil

No mostrar:

- métricas
- scores
- rankings
- timestamps dominantes
- evidencia previa
- badges múltiples

### Expanded

Una señal expandida debe mostrar:

- por qué importa
- qué hacer
- evidencia
- señales agrupadas si existen
- CTA contextual al agente

Solo una señal puede estar expandida a la vez.

## Reglas de layout

- urgentes arriba
- urgentes con mayor peso visual
- pressure field como superficie continua
- gaps mínimos
- no scroll inicial ideal en desktop
- structured asymmetry
- no freeform masonry
- no columnas tipo kanban
- no filtros visibles
- no sidebar
- no navegación pesada

## Color

El color es semántico y mínimo.

Debe entrar por:

- accent lateral
- icono
- indicador sutil

No usar:

- fondos saturados
- neon
- glow
- glassmorphism
- sombras de marketing

## Regla de evolución

Cualquier cambio futuro debe respetar:

```txt
1 problema operacional = 1 señal activa
```

Si dos señales repiten la misma decisión, deben agruparse antes de renderizar.

El frontend no debe resolver duplicados.
