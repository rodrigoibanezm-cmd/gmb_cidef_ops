# Dashboard materialization

## Estado

El dashboard usa Neon real mediante payloads materializados.

```txt
/api/dashboard
→ Neon.dashboard_snapshots
→ payload jsonb
→ frontend estático
```

## Invariante

```txt
/api/dashboard no calcula inteligencia.
Solo valida tenant, consulta dashboard_snapshots y devuelve JSON plano.
```

La inteligencia operacional se calcula antes, durante la materialización.

## Tabla

```sql
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  view TEXT NOT NULL DEFAULT 'full',
  payload JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'neon_materialized',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, snapshot_date, view)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_latest
ON dashboard_snapshots (tenant_id, view, snapshot_date DESC);
```

## Contrato de lectura

```sql
SELECT payload
FROM dashboard_snapshots
WHERE tenant_id = $1
  AND view = 'full'
ORDER BY snapshot_date DESC
LIMIT 1;
```

## Payload requerido

```txt
ok
source
tenant_id
tenant_name
updated_at
period
kpis
executive_summary
competitive_summary
mobile_priority
local_competitive_risk
red_flags
movements
rankings
```

## Regla principal

```txt
Red propia = ownership_group = 'own'
Competencia = ownership_group = 'competitor'
```

## Riesgo competitivo local

El producto central del dashboard es:

```txt
punto propio vs mejor competidor de la misma normalized_location
```

Campos mínimos:

```txt
own_name
location
own_rating
own_review_count
leader_name
leader_brand
leader_rating
gap_vs_leader
reason
```

## Retail tenants

Aplica a:

```txt
sodimac
beauty_plus
```

Resumen competitivo por marca:

```txt
dominant_competitor = leader_brand
```

Ejemplos:

```txt
Sodimac pierde liderazgo local en 10 zonas. Chilemat lidera en 7 de ellas.
Beauty Plus pierde liderazgo local en 9 zonas. Sokobox lidera en 6 de ellas.
```

## CIDEF

CIDEF no se resume por marca, porque DFSK/Dongfeng pueden ser parte de la red propia y también aparecer en dealers externos.

Para CIDEF:

```txt
dominant_competitor = leader_operator
```

Ejemplo:

```txt
CIDEF pierde frente a competidores en 10 puntos de la red. Derco lidera en 7 de ellos.
```

## Confianza mínima CIDEF

Para evitar ruido de 1-2 reviews:

```txt
review_count >= 20
```

Aplica a:

```txt
top
bottom
red_flags
kpis
local_competitive_risk
```

Esto explica que `average_rating` de CIDEF sea sobre puntos confiables, no sobre toda la red cruda.

## Estado actual por tenant

```txt
sodimac     OK
beauty_plus OK
cidef       OK con regla especial por operator y threshold >= 20 reviews
```

## Deudas pendientes

```txt
temporal / delta real
confidence visible en frontend
SQL parametrizado como job operativo
materialización automática post-carga
```
