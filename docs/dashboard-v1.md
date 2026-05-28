# Dashboard v1 — Presión operacional

## Estado

```txt
v1.0 aprobada
```

El dashboard queda definido como una superficie ejecutiva de presión operacional.

No es:

```txt
dashboard analítico
kanban
centro BI
agente conversacional
```

Es:

```txt
visor operacional estático para decidir dónde actuar primero
```

## Claim de pantalla

```txt
NexusG · Presión operacional
```

Bajada:

```txt
Decisiones comprimidas para actuar sin revisar un dashboard.
```

## Arquitectura

```txt
public/dashboard
→ /api/dashboard?tenant_id={tenant}&view=operational
→ JSON plano desde Neon
→ render estático
```

Invariante:

```txt
El dashboard no calcula inteligencia.
No clasifica.
No rankea.
No infiere.
Solo renderiza la foto operacional materializada.
```

## Layout aprobado

La pantalla se organiza en áreas tácticas:

```txt
Urgente hoy
Importante
Tareas
Monitorear
```

Regla de interacción:

```txt
Urgente hoy abre por defecto.
Solo un área queda abierta a la vez.
Al tocar otra área, se despliega su detalle abajo.
```

## Card

Cada card representa una señal operacional accionable.

Contenido visible:

```txt
headline
location
display_date
signal_count
risk/status
```

Contenido expandido:

```txt
Por qué importa
Qué hacer
Evidencia
Señales agrupadas
Botón al agente
```

## Agente

El botón de cada card no pasa contexto por URL.

Flujo aprobado:

```txt
click en Preguntar sobre esto
→ copiar prompt al clipboard
→ abrir agente en nueva pestaña
→ usuario pega el prompt
```

Motivo:

```txt
Los links con query params son frágiles para contexto largo.
Clipboard + nueva pestaña es más simple y robusto.
```

Prompt copiado:

```txt
Analiza esta prioridad operacional del tenant {tenant_id}:
{headline}
Por qué importa: {why_it_matters}
Acción sugerida: {suggested_action}
```

## Responsabilidades de archivos

```txt
public/dashboard/index.html
```

Carga assets estáticos del dashboard.

```txt
public/dashboard/config.js
```

Define `/api/dashboard` y URLs de agentes por tenant.

```txt
public/dashboard/app.js
```

Lee `tenant_id`, llama `/api/dashboard`, valida respuesta y monta el render.

```txt
public/dashboard/operational-pressure.js
```

Construye header, áreas tácticas, cards, acordeón y vínculo con agente.

```txt
public/dashboard/pressure-board.css
```

Define lenguaje visual, jerarquía, superficie táctil, cards y responsive.

## Decisión visual

Dirección aprobada:

```txt
relieve operacional digital
```

Principios:

```txt
serio
usable
con tensión
con profundidad
sin parecer SaaS plano
sin parecer corcho literal
sin parecer dashboard BI
```

Pendiente fuera de v1:

```txt
ajuste fino de paleta / branding
```

No cambiar estructura para ese ajuste.

## Fuera de alcance v1

```txt
nuevos cálculos backend
nuevos endpoints
scoring en frontend
persistencia de estado UI
personalización por usuario
```

## Criterio de cierre

La v1 queda cerrada cuando:

```txt
la pantalla permite ver presión operacional
el foco inicial es claro
el usuario puede abrir el agente con contexto copiado
el backend permanece sin cambios
```
