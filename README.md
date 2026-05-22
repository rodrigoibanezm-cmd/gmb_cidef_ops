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

## Endpoints movidos desde runtime

```txt
/api/admin/backfill/place-daily-metrics
/api/gmb/index/build
/api/gmb/index/status
```

## Librerías operacionales

```txt
lib/gmb/indexBuilder.js
lib/gmb/locationIndexes.js
lib/gmb/placeResolver.js
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

## Objetivo arquitectónico

```txt
runtime limpio y liviano
ops separado
menos funciones Vercel en runtime
captura desacoplada del agente
```
