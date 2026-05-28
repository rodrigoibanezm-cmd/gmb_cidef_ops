# Dashboard v1 — Presión operacional

## Estado

```txt
v1.0 aprobada
```

Este documento deja cerrada la versión 1.0 del front estático ubicado en:

```txt
public/dashboard
```

Debe permitir que otro chat, otra persona o una futura sesión entienda qué existe, qué hace cada archivo, qué no debe tocarse y cuál es la lógica aprobada.

## Definición del producto

El dashboard queda definido como una superficie ejecutiva de presión operacional.

No es:

```txt
dashboard analítico
kanban
centro BI
agente conversacional
pantalla de métricas
ranking exploratorio
```

Es:

```txt
visor operacional estático para decidir dónde actuar primero
```

Objetivo de uso:

```txt
abrir la pantalla
entender dónde hay presión
expandir una zona
leer evidencia mínima
preguntar al agente si se necesita profundidad
```

## Claim de pantalla

Texto aprobado:

```txt
NexusG · Presión operacional
```

Bajada aprobada:

```txt
Decisiones comprimidas para actuar sin revisar un dashboard.
```

No volver a usar:

```txt
Triaje operacional ejecutivo
Centro de decisión operacional
Reputation Command Center
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

El backend entrega las secciones y cards ya preparadas. El front solo las organiza visualmente.

## Flujo runtime

```txt
1. Usuario abre /dashboard?tenant_id={tenant}
2. app.js lee tenant_id desde la URL
3. app.js llama /api/dashboard?tenant_id={tenant}&view=operational
4. /api/dashboard valida tenant y lee Neon
5. app.js recibe JSON plano
6. operational-pressure.js construye la interfaz
7. pressure-board.css define la presentación visual
```

Si falta `tenant_id`, la pantalla muestra error local.

Si `/api/dashboard` falla o devuelve `ok=false`, la pantalla muestra error local.

## Contrato esperado del JSON

El front espera al menos:

```txt
ok: boolean
tenant_id: string
sections: array
card_count: number
max_cards: number
```

Cada sección esperada:

```txt
id: string
cards: array
```

IDs usados por v1:

```txt
urgente
importante
tareas
monitorear
```

Cada card puede usar:

```txt
id
section
type
status
color_key
headline
why_it_matters
suggested_action
evidence
children
agent_context
```

`agent_context` puede incluir:

```txt
location
display_date
signal_count
negative_count
positive_count
risk_type
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

Motivo:

```txt
reducir ruido visual
mantener foco inicial
evitar una grilla plana de 12 cards iguales
convertir la pantalla en una superficie táctica
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

Regla:

```txt
La card no debe transformarse en ficha analítica larga.
Debe contener solo lo suficiente para decidir o preguntar al agente.
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

Reglas:

```txt
El agente se abre con target _blank.
El link usa rel noopener noreferrer.
El prompt se copia antes de abrir o durante el click.
No usar ?q= ni query params para contexto.
```

## Inventario completo de archivos v1

### `public/dashboard/index.html`

Responsabilidad:

```txt
HTML base del dashboard estático.
Define el contenedor #app.
Carga CSS y scripts del front.
```

Carga actual:

```txt
./pressure-board.css
./config.js
./operational-pressure.js
./app.js
```

Tocar cuando:

```txt
se agregue o quite un asset estático
se cambie el orden de carga
se actualice cache busting
```

No tocar para:

```txt
cambiar layout
cambiar lógica de cards
cambiar contrato backend
```

### `public/dashboard/config.js`

Responsabilidad:

```txt
Configuración mínima del dashboard.
Define API_BASE.
Define AGENT_URLS por tenant.
```

Contiene:

```txt
window.DashboardConfig.API_BASE
window.DashboardConfig.AGENT_URLS
```

Tocar cuando:

```txt
se agregue un agente para otro tenant
se cambie la ruta de /api/dashboard
se actualice una URL de Custom GPT
```

No tocar para:

```txt
modificar visual
modificar cards
modificar acordeón
```

### `public/dashboard/app.js`

Responsabilidad:

```txt
Bootstrap del dashboard.
Lee tenant_id desde la URL.
Llama /api/dashboard.
Valida respuesta.
Renderiza PressureBoard.
Muestra estados de error/carga.
```

Flujo:

```txt
init()
→ leer tenant_id
→ fetch API_BASE + tenant_id + view=operational
→ validar res.ok y data.ok
→ PressureBoard.render(data)
```

Tocar cuando:

```txt
cambie el endpoint principal
cambie la forma de validar errores
se agregue un parámetro global de carga
```

No tocar para:

```txt
cambiar visual
cambiar estructura de áreas
cambiar diseño de cards
```

### `public/dashboard/operational-pressure.js`

Responsabilidad:

```txt
Componente principal del dashboard.
Construye header.
Construye áreas tácticas.
Construye cards.
Maneja acordeón de áreas.
Maneja expansión de cards.
Maneja copia de prompt y apertura del agente.
```

Contiene la configuración de áreas:

```txt
urgente → Urgente hoy → abierto por defecto
importante → Importante
tareas → Tareas
monitorear → Monitorear
```

Funciones clave:

```txt
sectionById(data, id)
signalWeight(card)
cardMeta(card)
areaTemperature(cards)
agentUrl(data)
agentPrompt(data, card)
copyText(value)
wireAgentLink(link, data, card)
renderHeader(data)
renderCard(card, data, opts)
renderAreaDeck(areas)
renderAreaDetail(area, data)
attachAreaBehavior(root)
render(data)
```

Tocar cuando:

```txt
cambie la estructura de áreas
cambie la interacción acordeón
cambie el prompt copiado al agente
cambie la estructura de card
```

No tocar para:

```txt
ajuste fino de colores
ajuste de espaciados visuales
cambio menor de sombras o tipografía
```

### `public/dashboard/pressure-board.css`

Responsabilidad:

```txt
Lenguaje visual completo de la pantalla.
Define fondo, superficie, jerarquía, cards, áreas, responsive y botones.
```

Define:

```txt
variables de color
fondo cálido
header sticky
áreas tácticas
cards con relieve
card primaria urgente
responsive desktop/tablet/mobile
botón mobile fijo
```

Tocar cuando:

```txt
se refine paleta
se ajuste branding
se cambien sombras
se cambie densidad visual
se mejore responsive
```

No tocar para:

```txt
cambiar contrato de datos
cambiar llamada a backend
cambiar prompt del agente
```

### `docs/dashboard-v1.md`

Responsabilidad:

```txt
Documento fuente de verdad para la v1 del dashboard.
Explica producto, arquitectura, archivos, interacción, invariantes y fuera de alcance.
```

Tocar cuando:

```txt
se cambie una decisión de diseño aprobada
se agregue una nueva pantalla
se modifique el flujo agente/dashboard
se cierre una nueva versión
```

No tocar para:

```txt
registrar ideas sueltas no aprobadas
hacer backlog informal
```

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

La pantalla debe sentirse como:

```txt
hay presión acumulada acá
```

No como:

```txt
hay una lista de componentes UI
```

Y tampoco como:

```txt
hay una maqueta creativa
```

## Pendiente fuera de v1

Único pendiente visual aceptado:

```txt
ajuste fino de paleta / branding
```

Regla:

```txt
No cambiar estructura para ajustar colores.
No rediseñar layout.
No volver a explorar direcciones completas.
```

## Fuera de alcance v1

```txt
nuevos cálculos backend
nuevos endpoints
scoring en frontend
persistencia de estado UI
personalización por usuario
nuevos dashboards analíticos
grillas BI
charts
ranking tables
```

## Criterio de cierre

La v1 queda cerrada cuando:

```txt
la pantalla permite ver presión operacional
el foco inicial es claro
Urgente hoy abre por defecto
solo un área queda abierta a la vez
el usuario puede abrir el agente en otra pestaña
el usuario puede pegar el prompt copiado
el backend permanece sin cambios
```

## Regla para futuros cambios

Antes de tocar código, revisar este documento.

Si el cambio rompe alguna de estas frases, no es ajuste v1:

```txt
visor operacional estático
presión operacional
render de foto materializada
sin inteligencia en frontend
sin dashboard BI
sin pasar contexto por URL
```
