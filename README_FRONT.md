# README_FRONT

## Estado

Documento de definición del frontend ejecutivo para `gmb_cidef_ops`.

El front vivirá en esta repo porque usa:

- mismo Vercel;
- mismo Neon;
- mismo backend operativo;
- mismos tenants;
- mismas tablas materializadas.

La regla base es simple:

```txt
el dashboard no existe para explorar
existe para priorizar
```

---

# Objetivo del front

Construir una interfaz ejecutiva para reputación multi-sucursal.

No es BI.
No es PowerBI.
No es Looker.
No es un explorador analítico.

Es un sistema para:

```txt
detectar
priorizar
interpretar
actuar
```

El usuario debe entender en segundos:

```txt
qué está mal
dónde está el riesgo
qué empeoró
qué requiere atención ahora
```

---

# Principio de arquitectura

El frontend no calcula inteligencia.

El frontend solo lee datos ya preparados por el backend.

```txt
Google Places / carga operativa
↓
Neon raw + snapshots
↓
backend recalcula tablas materializadas
↓
frontend lee
↓
agente profundiza
```

Nada crítico debe generarse on-run en el frontend.

---

# Materialización

Cada carga de información debe actualizar también las tablas intermedias necesarias para el dashboard.

La consulta del front debe ser lectura directa.

Regla:

```txt
cargar datos = actualizar foto ejecutiva
consultar front = solo leer foto ejecutiva
```

---

# Endpoint único

Por límite operativo de Vercel, el frontend debe consumir un solo endpoint nuevo.

Endpoint recomendado:

```txt
GET /api/dashboard?tenant_id=sodimac&view=full
```

Ejemplos:

```txt
GET /api/dashboard?tenant_id=sodimac&view=full
GET /api/dashboard?tenant_id=cidef&view=full
GET /api/dashboard?tenant_id=beauty_plus&view=full
```

No crear endpoints separados para summary, rankings, redflags o movements.

Todo debe venir en una respuesta única.

---

# Tenant en URL

No habrá login en el MVP.
No habrá selector de tenant en la UI.

El tenant se pasa por URL.

Ejemplos:

```txt
/dashboard?tenant_id=sodimac
/dashboard?tenant_id=cidef
/dashboard?tenant_id=beauty_plus
```

El frontend lee `tenant_id` desde la URL y llama al backend con ese tenant.

El backend debe validar contra allowlist.

Ejemplo:

```js
const ALLOWED_TENANTS = ["sodimac", "cidef", "beauty_plus"];
```

Si el tenant no está permitido, debe responder error.

Nota: esto no es seguridad real. Es suficiente para MVP interno/demo. Para clientes reales se debe agregar token público, magic link o auth.

---

# UX System

El producto usa dos interfaces cognitivas distintas.

No son simplemente dos versiones responsive del mismo dashboard.

Son:

```txt
mismo backend
mismo modelo
distinta interfaz cognitiva
```

## Desktop

```txt
Operational Network View
```

## Mobile

```txt
Executive Attention Radar
```

---

# Desktop: Operational Network View

## Objetivo

```txt
entiendo el estado completo de la operación reputacional
```

Desktop sirve para comprender la red.

Debe mostrar:

- estado general;
- comparación;
- distribución;
- prioridades;
- movimientos;
- ranking.

## Layout desktop

### Header

Debe incluir:

- tenant;
- última actualización;
- botón `Preguntar al agente`.

### KPI Row

Máximo 6 cards:

```txt
Nota promedio
Tendencia
Reviews
Tiendas críticas
Mayor caída
Mejor tienda
```

### Context Row

Dos bloques principales:

```txt
Red flags
Resumen ejecutivo
```

Esta fila es el corazón del dashboard.

Debe detectar, interpretar y priorizar.

### Operational Row

Bloques de operación:

```txt
Mayores alzas
Mayores bajas
Top 5
Bottom 5
```

## Qué no agregar en desktop

No agregar:

- filtros avanzados;
- analytics profundos;
- drilldowns infinitos;
- custom dashboards;
- pivots;
- BI widgets;
- navegación compleja.

Desktop puede tener densidad moderada, pero no debe transformarse en BI.

---

# Mobile: Executive Attention Radar

## Objetivo

```txt
en 5 segundos entiendo si debo actuar
```

Mobile no debe adaptar el dashboard desktop.

Mobile debe priorizar atención.

Debe parecer más:

```txt
Bloomberg terminal simplificada
+
centro de alertas
```

y menos:

```txt
dashboard corporativo tradicional
```

## Principio mobile

```txt
texto > gráficos
```

El valor real no es el chart.

El valor real es:

```txt
Maipú cayó fuerte
Ñuñoa sigue deteriorándose
7 tiendas bajo umbral
```

## Layout mobile

### 1. Hero principal

Debe ocupar gran parte de la primera pantalla.

Ejemplo:

```txt
4.20
↓ -0.08
7 críticas
```

Debajo debe ir una frase táctica:

```txt
La caída se concentra en Maipú y Ñuñoa.
```

Esto entrega:

- estado actual;
- tendencia;
- severidad;
- foco.

### 2. Alertas activas

Cards verticales tipo stack.

Ejemplo:

```txt
MAIPÚ
3.6 ★
↓ -0.22

Alta caída + muchas reviews
```

```txt
ÑUÑOA
3.8 ★
↓ -0.15

Bajo 4.0 sostenido
```

### 3. Prioridades

Resumen duro y breve.

Ejemplo:

```txt
7 tiendas críticas
3 con deterioro acelerado
2 requieren intervención inmediata
```

### 4. Resumen ejecutivo

Máximo 2 o 3 frases.

No usar párrafos largos.

Ejemplo:

```txt
Maipú y Ñuñoa requieren atención inmediata.
7 tiendas siguen bajo umbral crítico.
Constructor RM concentra alto volumen de quejas.
```

### 5. FAB fijo

El botón `Preguntar al agente` debe ser fijo abajo.

Debe sentirse como continuación natural del radar.

Flujo esperado:

```txt
ve alerta
↓
lee prioridad
↓
pregunta al agente
```

## Qué no agregar en mobile

No agregar:

- donut charts;
- tablas;
- rankings largos;
- comparativas horizontales;
- grids densos;
- navegación compleja;
- filtros;
- mini charts innecesarios.

---

# Diferencia conceptual

## Desktop

```txt
comprender la red
```

## Mobile

```txt
priorizar atención
```

Desktop muestra contexto operacional.
Mobile muestra prioridad inmediata.

---

# Navegación

Mantener navegación mínima.

Máximo:

```txt
Home
Alertas
Agente
```

No agregar navegación tipo BI.

---

# Agente

El agente no debe sentirse como chatbot decorativo.

Debe ser la continuación natural del sistema.

Dashboard:

```txt
detecta
prioriza
resume
```

Agente:

```txt
explica
contextualiza
recomienda
profundiza
```

Ejemplo de integración mobile:

```txt
Maipú cae -0.22
[Preguntar por qué]
```

---

# Respuesta esperada del backend

El endpoint `view=full` debe devolver todo lo necesario para renderizar desktop y mobile.

Estructura sugerida:

```json
{
  "ok": true,
  "tenant_id": "sodimac",
  "tenant_name": "Sodimac",
  "updated_at": "2026-05-26T09:18:00Z",
  "period": {
    "current_date": "2026-05-26",
    "comparison_label": "vs. semana anterior"
  },
  "kpis": {
    "average_rating": 4.2,
    "rating_delta": -0.08,
    "total_reviews": 18420,
    "reviews_delta": 386,
    "critical_stores": 7,
    "worst_drop": {
      "name": "Sodimac Maipú",
      "rating": 3.6,
      "delta": -0.22
    },
    "best_store": {
      "name": "Sodimac Las Condes",
      "rating": 4.7
    }
  },
  "executive_summary": {
    "desktop": "La red mantiene una nota estable de 4.20, con un leve descenso frente a la semana anterior. El deterioro se concentra en Maipú, Ñuñoa y Constructor RM.",
    "mobile": "Maipú y Ñuñoa requieren atención inmediata. 7 tiendas siguen bajo umbral crítico."
  },
  "red_flags": [
    {
      "rank": 1,
      "name": "Sodimac Maipú",
      "rating": 3.6,
      "delta": -0.22,
      "reason": "Alta caída + muchas reviews",
      "severity": "high"
    }
  ],
  "movements": {
    "up": [],
    "down": []
  },
  "rankings": {
    "top": [],
    "bottom": []
  },
  "mobile_priority": {
    "headline": "La caída se concentra en Maipú y Ñuñoa.",
    "critical_count": 7,
    "accelerating_count": 3,
    "immediate_action_count": 2
  }
}
```

---

# Copy / tono

Tono:

- ejecutivo;
- claro;
- directo;
- sin jerga técnica;
- sin promesas grandilocuentes;
- orientado a acción.

Evitar:

```txt
analítica avanzada
inteligencia artificial
modelo predictivo
insights accionables
```

Preferir:

```txt
requiere atención
bajo umbral
caída sostenida
deterioro concentrado
prioridad operacional
```

---

# Definición de éxito

El front funciona si un usuario puede responder en menos de 15 segundos:

```txt
¿estamos mejor o peor?
¿dónde está el problema?
¿qué tienda requiere atención primero?
¿debo preguntarle al agente?
```

Mobile funciona si responde en menos de 5 segundos:

```txt
¿debo actuar ahora?
¿dónde?
```

---

# Riesgo principal

El riesgo principal es contaminar el producto con lógica BI.

No transformar esto en:

```txt
otro dashboard corporativo
```

La dirección correcta es:

```txt
menos exploración
más claridad
más prioridad
más interpretación
```

---

# Decisión final

El frontend se implementará en `gmb_cidef_ops`.

Debe consumir tablas materializadas en Neon.

Debe usar un solo endpoint de lectura:

```txt
/api/dashboard?tenant_id={tenant_id}&view=full
```

Debe tener dos experiencias:

```txt
Desktop = Operational Network View
Mobile = Executive Attention Radar
```

Y debe proteger la idea central:

```txt
el dashboard no existe para explorar
existe para priorizar
```
