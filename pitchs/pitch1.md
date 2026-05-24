# pitch1: Neon como plano principal de datos

## Problema

El flujo operativo actual depende demasiado de Upstash Redis para actualizar datos.

La carga barata hoy sigue este camino conceptual:

Google Places -> Redis snapshot -> índice Redis -> backfill Neon -> runtime Neon

Esto genera fricción operacional y riesgo de bloqueo por cuota.

El caso actual lo confirmó: Upstash llegó al límite de requests y bloqueó cualquier operación que intentara leer o escribir Redis. Como consecuencia, no se pudo actualizar CIDEF aunque Neon y Vercel seguían operativos.

## Propuesta

Mover el sistema hacia una arquitectura Neon-first.

Principio central:

La fuente principal operativa y runtime debe ser Neon. Redis no debe ser requisito para actualizar ni responder.

Nuevo flujo objetivo para carga barata:

Google Places -> Neon place_daily_metrics -> runtime listo

Redis queda fuera del camino crítico.

## Valor diferencial

Reduce la fricción operativa.

Una actualización no debería requerir entender snapshots, índices, backfills ni cuotas Redis.

Reduce riesgo multi-tenant.

Cada operación debe exigir tenant_id y escribir directo en tablas tenant-aware.

Reduce costo mental.

El operador debe pensar en una acción: actualizar tenant.

Reduce superficie de falla.

Si Redis falla, el sistema debe poder seguir actualizando métricas base y respondiendo desde Neon.

## Riesgos

Migrar todo de una vez puede romper evidencia/reviews.

Redis todavía contiene datos útiles, especialmente snapshots históricos, reviews y evidencia cruda.

No conviene eliminar Redis abruptamente mientras no exista una tabla equivalente en Neon para reviews/evidencia.

El riesgo principal no es técnico, es de transición: dejar dos fuentes parcialmente vivas sin una regla clara de autoridad.

## Complejidad

Implementación incremental.

Primera etapa: carga barata directa a Neon.

Segunda etapa: cuando Upstash libere cuota, migrar snapshots/reviews existentes desde Redis hacia Neon.

Tercera etapa: decidir si Redis queda solo como cache/cola/rate-limit o si se elimina como dependencia estructural.

No requiere rediseñar el runtime, porque el runtime ya lee place_daily_metrics en Neon.

## Impacto

Alto impacto operacional.

Permite volver a cargar CIDEF aunque Upstash esté bloqueado.

Simplifica el flujo diario.

Alinea la arquitectura real con el runtime actual.

Convierte Redis de dependencia crítica a componente opcional.

## Dependencias

Neon debe tener las tablas mínimas:

- places
- place_daily_metrics

Para mover reviews más adelante, se requiere definir tablas nuevas o equivalentes:

- place_reviews
- review_seen o review_observations
- opcional: raw_snapshots si se quiere guardar payload completo

Google Places API sigue siendo necesaria para captura.

Upstash solo es necesario para migrar datos antiguos cuando vuelva la cuota o si se decide conservar evidencia temporal ahí.

## Señal de éxito

Una carga barata de CIDEF debe poder ejecutarse sin tocar Redis.

Resultado esperado:

- tenant_id obligatorio
- datos escritos en place_daily_metrics
- runtime_ready = true
- Redis requests = 0
- agente responde con datos nuevos desde Neon

Se considera validado cuando update light Neon cargue CIDEF completo y el runtime responda usando source = neon_place_daily_metrics.

## Principios de diseño

Neon es verdad operativa.

Redis no bloquea runtime.

tenant_id nunca tiene default silencioso.

Una acción operacional debe ser un endpoint.

La carga barata no necesita evidencia textual.

La evidencia/reviews puede migrar después.

No se optimiza una arquitectura rota; se simplifica.

La solución correcta es la que reduce pasos, no la que agrega orquestación.
