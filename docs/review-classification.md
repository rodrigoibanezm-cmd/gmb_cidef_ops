# Review classification

## Objetivo

Agregar una capa cualitativa sobre reviews capturadas desde Google Places.

```txt
review -> clasificación LLM -> alerta cualitativa -> dashboard / agente
```

## Regla de tenant y scope

El agente nunca clasifica todos los tenants.

```txt
tenant_id = tenant fijo del agente
scope default = own
```

Scopes válidos:

```txt
own        = marca propia, alertas internas
competitor = inteligencia competitiva
all        = lectura de mercado
```

Regla:

```txt
alertas críticas internas solo salen de scope=own
```

## Taxonomía v1

Campos obligatorios:

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
```

### topic

```txt
atencion
trato_cliente
ecommerce
postventa
despacho
precio
producto
stock
seguridad
legal_reputacional
otro
```

### sentiment

```txt
positive
neutral
negative
mixed
```

### severity

```txt
low
medium
high
critical
```

### risk_type

```txt
none
operacional
reputacional
legal
seguridad
legal_reputacional
fraude_acusacion
```

## Regla crítica: acusación grave al cliente

Si una review reporta que personal de tienda acusó al cliente de robo, hurto o delito:

```txt
severity = critical
risk_type = legal_reputacional
requires_alert = true
needs_human_review = true
safe_label = Acusación grave al cliente
```

El sistema no afirma que hubo robo.
El sistema informa que una persona reporta haber sido acusada de robo.

Frase segura:

```txt
Cliente reporta haber sido acusada de robo por personal de tienda.
Requiere revisión humana inmediata.
```

No usar:

```txt
Robo detectado
```

## Tabla Neon

```sql
create table if not exists review_classifications (
  tenant_id text not null,
  place_id text not null,
  review_hash text not null,
  classification_version text not null default 'v1',
  topic text,
  sentiment text,
  severity text,
  risk_type text,
  requires_alert boolean not null default false,
  needs_human_review boolean not null default false,
  safe_label text,
  summary text,
  evidence_excerpt text,
  classified_at timestamptz not null default now(),
  raw_llm jsonb,
  primary key (tenant_id, place_id, review_hash, classification_version)
);

create index if not exists idx_review_classifications_tenant_alert
  on review_classifications (tenant_id, requires_alert, severity);

create index if not exists idx_review_classifications_place
  on review_classifications (tenant_id, place_id);
```

## Endpoint operativo propuesto

```txt
POST /api/reviews/classify-missing?tenant_id=beauty_plus&scope=own&limit=20
```

Hace:

```txt
busca reviews sin clasificación v1
filtra por tenant_id
filtra por scope via places.ownership_group
clasifica con LLM
persiste en review_classifications
retorna resumen operativo
```

## Invariante

```txt
El front no clasifica.
El agente no persiste clasificación conversacional.
El agente gatilla.
El backend clasifica.
Neon guarda.
Dashboard y agente leen.
```
