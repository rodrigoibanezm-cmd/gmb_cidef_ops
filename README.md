# GMB CIDEF OPS

Infraestructura operacional separada del agente/runtime.

## Responsabilidad

```txt
captura Google Places
backfill Neon
indexación Redis
migraciones
scripts operacionales
cron jobs
admin/debug
```

## Esta repo NO responde preguntas

```txt
No contiene:
- agent router
- render ejecutivo
- runtime de preguntas
- ROM del agente
```

Eso vive en:

```txt
gmb_cidef
```

## Infraestructura compartida

```txt
Neon/Postgres
Upstash Redis
Google Places API
```

## Principio

```txt
El agente consulta.
Ops mantiene los datos.
```

## Endpoints operativos

```txt
/api/gmb/capture/demo-next
/api/gmb/capture/reviews-next
/api/admin/backfill/place-daily-metrics
/api/gmb/index/build
/api/gmb/index/status
```

## Captura

### Captura barata

```txt
POST /api/gmb/capture/demo-next
```

Uso:

```powershell
$ops = "https://gmb-cidef-ops.vercel.app"

$result = Invoke-RestMethod `
  "$ops/api/gmb/capture/demo-next?tenant_id=sodimac&limit=1" `
  -Method POST

$result | ConvertTo-Json -Depth 20 | Out-File ".\ops_capture_demo_test.json" -Encoding utf8
```

Validado:

```txt
tenant_id = sodimac
captured_date = 2026-05-22
total = 161
processed = 1
saved = 1
failed = 0
```

### Captura cara / reviews

```txt
POST /api/gmb/capture/reviews-next?confirm=true
```

Regla:

```txt
reviews requiere confirm=true
```

## Backfill Neon

```txt
POST /api/admin/backfill/place-daily-metrics
```

Validado:

```txt
sodimac 2026-05-21: inserted=161, missing=0, failed=0
cidef 2026-05-21: inserted=727, missing=0, failed=0
```

## Indexación Redis

```txt
POST /api/gmb/index/build
GET  /api/gmb/index/status
```

Validado para Sodimac:

```txt
snapshots = 161
indexed_places = 161
updated = true
```

## Librerías operacionales

```txt
lib/gmb/capturePlacesDemo.js
lib/gmb/capturePlacesReviews.js
lib/gmb/indexBuilder.js
lib/gmb/locationIndexes.js
lib/gmb/placeResolver.js
lib/gmb/placesPostgres.js
lib/gmb/reviews.js
lib/gmb/keys.js
lib/gmb/redis.js
lib/gmb/postgres.js
```

## Modelo de ubicación

```txt
normalized_location = comuna
market_group = ciudad / zona mayor
region = región
```

## Env vars necesarias

```txt
DATABASE_URL
KV_REST_API_URL
KV_REST_API_TOKEN
GOOGLE_PLACES_API_KEY
```

También se acepta:

```txt
GOOGLE_MAPS_API_KEY
```

como fallback para captura.

## Objetivo arquitectónico

```txt
runtime limpio y liviano
ops separado
menos funciones Vercel en runtime
captura desacoplada del agente
```
