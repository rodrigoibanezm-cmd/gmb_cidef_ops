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

## Principio central

```txt
Manual no significa inventado.
Manual significa curado con evidencia real trazable.
```

Cada clasificación y cada card debe poder auditarse contra una review real en Neon.

Fuente primaria:

```txt
place_reviews
```

Fuente intermedia:

```txt
review_classifications
```

Fuente final para frontend operacional:

```txt
operational_cards
```

Flujo:

```txt
place_reviews
→ clasificación manual emulando agente
→ review_classifications
→ agrupación por tienda/patrón
→ operational_cards
→ /api/dashboard?view=operational
→ frontend
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

## Criterio para `review_classifications`

Cada fila clasificada representa una review real.

Campos mínimos:

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
raw_llm
```

Para curación manual usar:

```txt
classification_version = manual_sodimac_v1
raw_llm.source = manual_emulation
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

## SQL base: reviews pendientes

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

---

## SQL base: agrupación de clasificaciones

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

---

## Regla final

```txt
La card debe ser incómoda, accionable y demostrable.
Si no se puede demostrar con reviews, no entra.
```
