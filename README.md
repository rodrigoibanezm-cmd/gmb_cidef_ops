# GMB CIDEF OPS

Infraestructura operacional separada del agente/runtime.

## Responsabilidad

```txt
captura Google Places
carga Neon
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

## Infraestructura

```txt
Neon/Postgres
Google Places API
```

## Principio operativo

```txt
1 acción operacional = 1 endpoint.
El agente consulta.
Ops mantiene los datos.
Neon es el único plano operacional.
Redis/Upstash no forma parte de la arquitectura.
```

## Endpoints operativos actuales

### Actualización barata Neon

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

### Actualización completa Neon

```txt
POST /api/gmb/update/full-neon?confirm=true
```

Hace:

```txt
captura Google Places con reviews
place_snapshots en Neon
place_daily_metrics en Neon
place_reviews en Neon
runtime listo
```

## Endpoints eliminados

Los siguientes endpoints quedaron removidos:

```txt
/api/gmb/update/light
/api/gmb/update/full
/api/gmb/capture/demo-next
/api/gmb/capture/reviews-next
```

Respuesta:

```txt
410 endpoint_removed
```

## Validación operacional

Estado validado:

```txt
Sodimac full-neon OK
CIDEF full-neon OK
Beauty Plus full-neon OK
runtime Neon-only OK
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

## Objetivo arquitectónico

```txt
runtime limpio y liviano
ops separado
captura desacoplada del agente
operación diaria en endpoint simple
Neon como único plano de datos
sin Redis/Upstash
```
