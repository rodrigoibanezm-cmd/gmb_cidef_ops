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

## Contrato de escritura

La materialización escribe una foto por:

```txt
tenant_id + snapshot_date + view
```

Si se materializa el mismo tenant, fecha y view, se reemplaza esa foto diaria.

Si se materializa otra fecha, queda una nueva fila histórica.

## Regla anti-snapshot incompleto

No se materializa dashboard si la captura del día está incompleta.

Validación previa:

```txt
captured_places >= total places keep del tenant
```

Fuente de conteo:

```txt
total_places = places donde tenant_id = X y status keep
captured_places = place_daily_metrics distintos para tenant_id = X y captured_date = snapshot_date
```

Si falta carga, `rebuildDashboardSnapshot` falla con:

```txt
error.code = capture_incomplete
```

Esto protege:

```txt
/api/gmb/update/light-neon
/api/gmb/update/full-neon
/api/dashboard/rebuild
```

Resultado esperado en cargas chicas o parciales:

```txt
status = incomplete
dashboard_rebuilt = false
dashboard_snapshot = null
dashboard_error.code = capture_incomplete
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

## Estado operativo

```txt
light-neon  actualiza dashboard_snapshots solo si captura completa
full-neon   actualiza dashboard_snapshots solo si captura completa
rebuild     protegido contra capturas incompletas
```

Smoke validado:

```txt
light-neon parcial → dashboard_rebuilt=false / capture_incomplete
full-neon parcial  → dashboard_rebuilt=false / capture_incomplete
```

## Deudas pendientes

```txt
temporal / delta real
confidence visible en frontend
SQL/job parametrizado como operación estable
pending_actions generado por agente auditor
```
