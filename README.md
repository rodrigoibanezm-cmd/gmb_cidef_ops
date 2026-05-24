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
Google Places API
Upstash Redis legacy temporal
```

## Principio operativo

```txt
1 acción operacional = 1 endpoint.
El agente consulta.
Ops mantiene los datos.
Neon es el plano principal de datos.
Redis no debe estar en el camino crítico.
```

## Uso recomendado actual

### Actualización barata Neon

Endpoint recomendado para operación diaria barata mientras Redis está fuera del camino crítico:

```txt
POST /api/gmb/update/light-neon
```

Hace:

```txt
captura barata Google Places
place_snapshots en Neon
place_daily_metrics en Neon
runtime listo
```

No toca:

```txt
Upstash Redis
índices Redis
backfill Redis -> Neon
```

Uso unitario:

```powershell
$ops = "https://gmb-cidef-ops.vercel.app"

Invoke-RestMethod `
  "$ops/api/gmb/update/light-neon?tenant_id=cidef&limit=30&max_batches=1" `
  -Method POST |
  ConvertTo-Json -Depth 30 |
  Out-File ".\cidef_light_neon_test.json" -Encoding utf8
```

Validación operativa 2026-05-24:

```txt
limit=30 funcionó bien en Sodimac.
Sodimac completó 161 places con failed=0.
CIDEF quedó cargado en Neon con carga barata.
```

Nota operativa:

```txt
Por ahora limit=30 + max_batches=1 es el tamaño validado para evitar timeout de Vercel.
Para front/admin, el botón debe disparar una tanda y repetir cada 5 segundos hasta done=true.
```

Salida esperada:

```txt
runtime_ready=true
flow="Google Places light -> Neon place_snapshots + place_daily_metrics"
failed=0 idealmente
```

## Flujo Redis legacy

Los siguientes endpoints existen, pero no son el flujo recomendado mientras Upstash esté limitado o mientras se migra a Neon-first.

```txt
/api/gmb/update/light
/api/gmb/update/full
/api/gmb/capture/demo-next
/api/gmb/capture/reviews-next
/api/admin/backfill/place-daily-metrics
/api/gmb/index/build
/api/gmb/index/status
```

## Actualización barata Redis legacy

```txt
POST /api/gmb/update/light
```

Hace:

```txt
captura barata Google Places
snapshot Redis
índice Redis
backfill Neon place_daily_metrics
runtime listo
```

Estado:

```txt
legacy / no recomendado como operación principal
```

## Actualización completa / cara Redis legacy

```txt
POST /api/gmb/update/full?confirm=true
```

Hace:

```txt
captura Google Places con reviews
snapshot Redis
reviews Redis
índice Redis
backfill Neon place_daily_metrics
runtime listo
```

Estado:

```txt
legacy / pendiente reemplazo por full-neon
```

## Pendiente inmediato

```txt
/api/gmb/update/full-neon
runtime evidencia -> Neon
front/admin operativo
migración Redis legacy -> Neon cuando vuelva la cuota
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
GOOGLE_PLACES_API_KEY
```

También se acepta:

```txt
GOOGLE_MAPS_API_KEY
```

como fallback para captura.

Legacy Redis requiere además:

```txt
KV_REST_API_URL
KV_REST_API_TOKEN
```

## Objetivo arquitectónico

```txt
runtime limpio y liviano
ops separado
menos funciones Vercel en runtime
captura desacoplada del agente
operación diaria en endpoint simple
Neon como plano único de datos
Redis fuera del camino crítico
```
