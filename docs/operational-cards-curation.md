# Operational Cards · Criterio de curación manual

## Estado

Documento operativo para construir `review_classifications` y `operational_cards` con evidencia real desde Google Reviews ya cargadas en Neon.

Aplica inicialmente a:

```txt
tenant_id = sodimac
view = operational
tabla final = operational_cards
```

---

## Objetivo

Construir la vista de **Presión operacional** con datos reales, sin depender todavía de una automatización completa.

La operación puede funcionar de dos formas:

```txt
modo manual     = humano/LLM clasifica reviews y escribe Neon con SQL
modo automático = agente detecta reviews pendientes, clasifica silenciosamente y persiste resultados
```

Ambos modos deben producir el mismo resultado lógico:

```txt
place_reviews
→ review_classifications
→ operational_cards
→ /api/dashboard?tenant_id={tenant}&view=operational
→ frontend
```

---

## Principio central

```txt
Manual no significa inventado.
Manual significa curado con evidencia real trazable.
```

Cada clasificación y cada card debe poder auditarse contra una review real en Neon.

---

## Tablas involucradas

### `places`

Catálogo de tiendas y competidores.

Uso en este flujo:

```txt
identificar tienda
validar tenant
validar ownership_group
obtener name, normalized_location, brand, status
```

Campos usados:

```txt
tenant_id
place_id
name
brand
normalized_location
ownership_group
status
```

---

### `place_reviews`

Fuente primaria de evidencia textual.

Uso en este flujo:

```txt
leer reviews reales
extraer evidence_excerpt
obtener review_hash auditable
filtrar rating <= 2 para señales negativas iniciales
```

Campos usados:

```txt
tenant_id
place_id
review_hash
review_date
rating
text
author
```

---

### `review_classifications`

Tabla intermedia semántica.

Cada fila representa **una review clasificada**.

Uso en este flujo:

```txt
normalizar topic
calcular sentiment/severity/risk_type
crear safe_label
crear summary
guardar evidence_excerpt
marcar requires_alert / needs_human_review
```

Campos usados:

```txt
tenant_id
place_id
review_hash
classification_version
topic
sentiment
severity
risk_type
requires_alert
needs_human_review
safe_label
summary
evidence_excerpt
classified_at
raw_llm
```

Para curación manual usar:

```txt
classification_version = manual_sodimac_v1
raw_llm.source = manual_emulation
```

---

### `operational_cards`

Tabla final que consume el front de Presión operacional.

Cada fila representa **una card operacional**, no una review.

Uso en este flujo:

```txt
agrupar clasificaciones por tienda/patrón
priorizar secciones
renderizar frontend operacional
activar prompt contextual hacia agente
```

Campos usados:

```txt
tenant_id
card_date
section
type
scope
status
color_key
icon_key
headline
why_it_matters
suggested_action
evidence_json
children_json
agent_context
priority_order
created_at
updated_at
```

---

## Flujo manual

El flujo manual emula lo que debería hacer el agente automáticamente.

### Paso 1: buscar reviews pendientes

Se buscan reviews reales que aún no tengan clasificación.

```sql
select
  r.tenant_id,
  r.place_id,
  r.review_hash,
  r.review_date,
  r.rating,
  r.text,
  p.name as place_name,
  p.normalized_location
from place_reviews r
join places p
  on p.tenant_id = r.tenant_id
 and p.place_id = r.place_id
left join review_classifications c
  on c.tenant_id = r.tenant_id
 and c.place_id = r.place_id
 and c.review_hash = r.review_hash
where r.tenant_id = 'sodimac'
  and p.ownership_group = 'own'
  and coalesce(p.status, 'keep') = 'keep'
  and r.rating <= 2
  and r.text is not null
  and c.review_hash is null
order by
  p.name,
  r.review_date desc nulls last
limit 30;
```

### Paso 2: clasificar manualmente

Para cada review, completar una fila en `review_classifications`.

Regla:

```txt
1 review real = 1 fila en review_classifications
```

Ejemplo mínimo:

```sql
insert into review_classifications (
  tenant_id,
  place_id,
  review_hash,
  classification_version,
  topic,
  sentiment,
  severity,
  risk_type,
  requires_alert,
  needs_human_review,
  safe_label,
  summary,
  evidence_excerpt,
  classified_at,
  raw_llm
)
values (
  'sodimac',
  'PLACE_ID_REAL',
  'REVIEW_HASH_REAL',
  'manual_sodimac_v1',
  'atencion',
  'negative',
  'high',
  'operacional',
  true,
  false,
  'Etiqueta segura y ejecutiva',
  'Resumen fiel de lo que reporta el cliente.',
  'Extracto textual real de la review...',
  now(),
  '{"source":"manual_emulation","place_name":"NOMBRE_TIENDA","review_rating":1}'::jsonb
);
```

### Paso 3: agrupar clasificaciones

Se revisan señales agrupadas para decidir qué merece card.

```sql
select
  p.place_id,
  p.name,
  p.normalized_location,
  c.topic,
  c.risk_type,
  max(c.severity) as max_severity,
  count(*) as signal_count,
  count(*) filter (where c.sentiment = 'negative') as negative_count,
  array_agg(c.safe_label order by c.classified_at desc) as labels,
  array_agg(c.evidence_excerpt order by c.classified_at desc) as evidence
from review_classifications c
join places p
  on p.tenant_id = c.tenant_id
 and p.place_id = c.place_id
where c.tenant_id = 'sodimac'
  and c.classification_version = 'manual_sodimac_v1'
group by
  p.place_id,
  p.name,
  p.normalized_location,
  c.topic,
  c.risk_type
order by
  signal_count desc,
  negative_count desc
limit 30;
```

### Paso 4: crear `operational_cards`

La card se crea desde `review_classifications`, no desde texto inventado.

Regla:

```txt
1 card = 1 tienda + 1 patrón operacional + evidencia trazable
```

Ejemplo base:

```sql
insert into operational_cards (
  tenant_id,
  card_date,
  section,
  type,
  scope,
  status,
  color_key,
  icon_key,
  headline,
  why_it_matters,
  suggested_action,
  evidence_json,
  children_json,
  agent_context,
  priority_order,
  created_at,
  updated_at
)
select
  'sodimac',
  current_date,
  'urgente',
  'incidente',
  'tienda',
  'escalando',
  'red',
  'pattern',
  'Headline operativo basado en la tienda y patrón',
  'Explicación breve basada solo en las señales clasificadas.',
  'Acción sugerida operacional, sin afirmar acciones ya ejecutadas.',
  jsonb_agg(c.evidence_excerpt order by c.classified_at desc),
  jsonb_agg(jsonb_build_object(
    'topic', c.topic,
    'summary', c.summary,
    'severity', c.severity,
    'risk_type', c.risk_type,
    'sentiment', c.sentiment,
    'safe_label', c.safe_label,
    'review_hash', c.review_hash,
    'classified_at', c.classified_at,
    'evidence_excerpt', c.evidence_excerpt
  ) order by c.classified_at desc),
  jsonb_build_object(
    'topic', 'atencion',
    'source', 'manual_sodimac_v1',
    'location', 'normalized_location',
    'place_id', 'PLACE_ID_REAL',
    'risk_type', 'operacional',
    'store_name', 'NOMBRE_TIENDA',
    'alert_count', count(*),
    'signal_count', count(*),
    'negative_count', count(*) filter (where c.sentiment = 'negative'),
    'positive_count', count(*) filter (where c.sentiment = 'positive'),
    'priority_score', 70,
    'display_date', 'Mes Año',
    'last_classified_at', max(c.classified_at)
  ),
  1,
  now(),
  now()
from review_classifications c
where c.tenant_id = 'sodimac'
  and c.place_id = 'PLACE_ID_REAL'
  and c.classification_version = 'manual_sodimac_v1';
```

### Paso 5: validar frontend

```sql
select
  section,
  priority_order,
  headline,
  evidence_json
from operational_cards
where tenant_id = 'sodimac'
  and card_date = current_date
order by priority_order;
```

Luego abrir:

```txt
/dashboard/?tenant_id=sodimac&view=operational
```

---

## Flujo automático esperado

El flujo automático replica el flujo manual, pero sin intervención humana.

### 1. Drift silencioso inicial

Al iniciar el agente, antes de responder al usuario, el runtime consulta si existen reviews propias sin clasificación.

Endpoint runtime:

```txt
GET /api/reviews/classify-missing?action=pending&tenant_id={tenant_id}&scope=own&limit=20
```

La repo runtime proxyea este endpoint hacia ops:

```txt
gmb_cidef/api/reviews/classify-missing.js
→ https://gmb-cidef-ops.vercel.app/api/reviews/classify-missing
```

### 2. Clasificación semántica por LLM

El agente clasifica cada review pendiente usando el contrato de `ReviewClassification`:

```txt
topic
sentiment
severity
risk_type
requires_alert
needs_human_review
safe_label
summary
evidence_excerpt
raw_llm
```

### 3. Persistencia silenciosa

El agente guarda las clasificaciones:

```txt
POST /api/reviews/classify-missing?action=commit
```

Body esperado:

```json
{
  "classifications": [
    {
      "tenant_id": "sodimac",
      "place_id": "...",
      "review_hash": "...",
      "topic": "atencion",
      "sentiment": "negative",
      "severity": "high",
      "risk_type": "operacional",
      "requires_alert": true,
      "needs_human_review": false,
      "safe_label": "Mala atención en sala",
      "summary": "Cliente reporta falta de ayuda en tienda.",
      "evidence_excerpt": "Tuve que preguntarle a tres personas...",
      "raw_llm": {
        "source": "agent_silent_classification"
      }
    }
  ]
}
```

### 4. Materialización de cards

Una tarea posterior, endpoint admin o job programado debe agrupar `review_classifications` y escribir `operational_cards`.

Regla:

```txt
El agente clasifica reviews.
La materialización construye cards.
El frontend solo lee cards.
```

---

## Relación con `/api/dashboard`

El frontend operacional no consulta reviews.

Consume:

```txt
/api/dashboard?tenant_id=sodimac&view=operational
```

Ese endpoint lee:

```txt
operational_cards
```

Regla:

```txt
/api/dashboard no calcula inteligencia.
Solo transporta la foto operacional ya materializada.
```

---

## Regla anti-invento

No se permite crear una card si no existe:

```txt
place_id real
review_hash real
texto real de review
evidence_excerpt derivado del texto
```

No se permite inventar:

```txt
hechos no presentes en la review
fechas
cantidades
riesgos legales
causas operacionales internas
acciones ejecutadas
responsables internos
```

Sí se permite resumir:

```txt
texto largo → summary breve
texto largo → evidence_excerpt fiel
review puntual → safe_label operativo
```

---

## Catálogo recomendado de topic para Sodimac

Usar catálogo cerrado cuando sea posible:

```txt
atencion
postventa
stock
precio
seguridad
operacion
producto
despacho
retiro_tienda
arriendo_herramientas
otro
```

Regla:

```txt
Si el patrón puede expresarse con catálogo común, usar catálogo común.
Si el patrón es operacionalmente relevante y repetible para homecenter, se permite topic específico.
```

Ejemplos específicos aceptados para Sodimac:

```txt
retiro_tienda
arriendo_herramientas
```

Evitar topics demasiado abiertos si no aportan decisión:

```txt
infraestructura
operacion_tienda
```

Preferir:

```txt
operacion
seguridad
atencion
postventa
precio
```

---

## Criterio de severity

### low

Review positiva, neutra o problema menor sin urgencia operacional.

### medium

Problema puntual de experiencia:

```txt
mala atención puntual
fila larga puntual
falta de ayuda
problema menor de caja
```

### high

Problema con impacto operacional claro:

```txt
maltrato explícito
esperas largas graves
postventa crítica
producto riesgoso
conflicto fuerte de precio
seguridad deficiente
repetición en misma tienda
```

### critical

Solo usar si hay acusación grave, riesgo físico/legal directo o daño reputacional severo explícito:

```txt
acusación de robo
humillación pública
riesgo de seguridad grave
fraude explícito
amenaza legal clara
```

No usar `critical` por intuición.

---

## Criterio de risk_type

```txt
none                = sin riesgo relevante
operacional         = falla de servicio/proceso/tienda
reputacional        = daño de marca por trato o experiencia
legal               = conflicto legal explícito
seguridad           = riesgo físico/seguridad
legal_reputacional  = mezcla de acusación, derechos consumidor, guardias, precio, trato público
```

Regla:

```txt
Si menciona ley, derechos del consumidor, acusación, guardias agresivos o precio exigido legalmente, evaluar legal_reputacional.
```

---

## Criterio para crear `operational_cards`

Una card no es una review.

Una card es:

```txt
una tienda
+ un patrón operacional
+ evidencia trazable
+ acción sugerida
```

### Mínimo para card

```txt
1 tienda identificada
1 patrón claro
1+ review real clasificada
children_json con review_hash
```

### Preferencia

```txt
2+ reviews en la misma tienda
mismo topic o patrón compatible
sentiment negativo
severity medium/high
```

---

## Secciones del frontend operacional

El frontend usa tres secciones:

```txt
urgente
importante
tareas
```

### urgente

Usar cuando:

```txt
2+ señales negativas high en la misma tienda
1 señal high/critical con riesgo legal_reputacional o seguridad
patrón que requiere acción inmediata
```

Valores recomendados:

```txt
section = urgente
type = incidente
status = escalando
color_key = red
icon_key = pattern | incident
priority_score >= 70
```

### importante

Usar cuando:

```txt
1 señal high con impacto operacional claro
2+ señales medium compatibles
patrón que puede escalar si se repite
```

Valores recomendados:

```txt
section = importante
type = patron | incidente
status = monitorear
color_key = yellow
icon_key = pattern
priority_score 35-69
```

### tareas

Usar cuando:

```txt
1 señal medium puntual
seguimiento operativo
problema real pero aún no recurrente
```

Valores recomendados:

```txt
section = tareas
type = incidente | patron
status = monitorear
color_key = yellow | blue
icon_key = incident | pattern
priority_score < 35
```

---

## Orden recomendado

`priority_order` debe reflejar prioridad ejecutiva, no orden de inserción.

Regla:

```txt
urgente primero
importante después
tareas al final
```

Dentro de cada sección ordenar por:

```txt
risk_type
severity
signal_count
recencia
claridad de evidencia
```

---

## Evidence

`evidence_json` debe contener frases cortas y fieles.

Correcto:

```txt
"El proceso de recepción y entrega es de lentitud vergonzoso... una hora y media... Solo atiende una persona."
```

Incorrecto:

```txt
"La tienda tiene mala operación interna comprobada."
```

La evidencia debe venir de `evidence_excerpt` o texto directo de review.

---

## children_json

Cada child debe contener:

```txt
topic
summary
severity
risk_type
sentiment
safe_label
review_hash
classified_at
evidence_excerpt
```

Regla:

```txt
Sin review_hash, la card no es auditable.
```

---

## agent_context

Campos recomendados:

```txt
topic
source
location
place_id
risk_type
store_name
alert_count
signal_count
negative_count
positive_count
priority_score
display_date
last_classified_at
```

Para curación manual:

```txt
source = manual_sodimac_v1
```

---

## Ejemplo validado

Card operacional Sodimac validada:

```txt
Sodimac Homecenter Ñuble: atención y arriendo de herramientas bajo presión
```

Criterio:

```txt
2 reviews negativas
misma tienda
rating 1
severity high
patrones: atención + arriendo de herramientas
section = urgente
```

Evidencias usadas:

```txt
"Entré a las 13:00. Salí a las 17:00 disgustada... Y esto no fue guía, fue maltrato."
"El proceso de recepción y entrega es de lentitud vergonzoso... una hora y media... Solo atiene una persona."
```

---

## Regla final

```txt
La card debe ser incómoda, accionable y demostrable.
Si no se puede demostrar con reviews, no entra.
```
