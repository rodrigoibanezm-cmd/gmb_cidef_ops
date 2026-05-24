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

## Principio operativo

```txt
1 acción operacional = 1 endpoint.
El agente consulta.
Ops mantiene los datos.
```

## Uso recomendado

### Actualización barata completa

Endpoint recomendado para operación diaria barata:

```txt
POST /api/gmb/update/light
```

Hace todo el flujo:

```txt
captura barata Google Places
loop interno por lotes
pausa entre lotes
snapshot Redis
índice Redis
backfill Neon place_daily_metrics
runtime listo
```

Uso:

```powershell
$ops = "https://gmb-cidef-ops.vercel.app"

Invoke-RestMethod `
  "$ops/api/gmb/update/light?tenant_id=cidef&limit=20" `
  -Method POST |
  ConvertTo-Json -Depth 20 |
  Out-File ".\cidef_update_light.json" -Encoding utf8
```

Parámetros:

```txt
tenant_id   requerido operativo
limit       default 20
pause_ms    default 5000
max_batches default 100
```

Salida esperada:

```txt
ok=true
flow="Redis snapshot barato -> Redis index -> Neon runtime"
index.snapshots > 0
backfill.inserted > 0
backfill.missing = 0 idealmente
```

### Actualización completa / cara con reviews

Endpoint recomendado para captura con reseñas:

```txt
POST /api/gmb/update/full?confirm=true
```

Hace todo el flujo:

```txt
captura Google Places con reviews
loop interno por lotes
pausa entre lotes
snapshot Redis
reviews Redis
índice Redis
backfill Neon place_daily_metrics
runtime listo
```

Uso:

```powershell
$ops = "https://gmb-cidef-ops.vercel.app"

Invoke-RestMethod `
  "$ops/api/gmb/update/full?tenant_id=cidef&limit=10&confirm=true" `
  -Method POST |
  ConvertTo-Json -Depth 20 |
  Out-File ".\cidef_update_full.json" -Encoding utf8
```

Regla:

```txt
confirm=true es obligatorio porque captura reviews y puede tener mayor costo.
```

Parámetros:

```txt
tenant_id   requerido operativo
limit       default 10
pause_ms    default 5000
max_batches default 100
confirm     true obligatorio
```

Salida esperada:

```txt
ok=true
flow="Redis snapshot completo + reviews -> Redis index -> Neon runtime"
index.snapshots > 0
index.reviews >= 0
backfill.inserted > 0
backfill.missing = 0 idealmente
```

## Endpoints operativos internos / legacy

Estos endpoints siguen existiendo para debug, validación o ejecución manual por partes.
No son el flujo recomendado normal.

```txt
/api/gmb/capture/demo-next
/api/gmb/capture/reviews-next
/api/admin/backfill/place-daily-metrics
/api/gmb/index/build
/api/gmb/index/status
```

## Captura barata legacy

```txt
POST /api/gmb/capture/demo-next
```

Uso unitario/debug:

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

## Captura cara / reviews legacy

```txt
POST /api/gmb/capture/reviews-next?confirm=true
```

Regla:

```txt
reviews requiere confirm=true
```

## Backfill Neon manual

```txt
POST /api/admin/backfill/place-daily-metrics
```

Validado:

```txt
sodimac 2026-05-21: inserted=161, missing=0, failed=0
cidef 2026-05-21: inserted=727, missing=0, failed=0
```

## Indexación Redis manual

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
operación diaria en un solo endpoint
```
