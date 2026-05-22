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

## No contiene

```txt
agent router
render ejecutivo
runtime de preguntas
ROM del agente
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
