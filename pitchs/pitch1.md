# pitch1: Neon como plano unico de datos

## Problema

El flujo operativo actual quedo partido entre Upstash Redis y Neon.

La carga barata sigue este camino conceptual:

Google Places -> Redis snapshot -> indice Redis -> backfill Neon -> runtime Neon

Ese flujo ya no calza con el estado real del producto.

El runtime usa Neon, pero la actualizacion todavia depende de Redis. Eso agrega pasos, cuotas, puntos de falla y costo mental.

El caso actual lo confirmo: Upstash llego al limite de requests y bloqueo cualquier operacion que intentara leer o escribir Redis. Como consecuencia, no se pudo actualizar CIDEF aunque Neon, Vercel y Google Places seguian disponibles.

El problema no es solo la cuota. El problema estructural es que Upstash quedo en el camino critico.

## Propuesta

Mover la arquitectura objetivo a Neon como plano unico de datos.

Principio central:

Neon debe ser la fuente de verdad operativa, historica y runtime.

Upstash Redis debe salir del flujo normal.

Nuevo flujo objetivo para carga barata:

Google Places -> Neon -> runtime listo

Nuevo flujo objetivo para carga completa:

Google Places reviews -> Neon -> runtime/evidencia lista

Redis queda solo como fuente legacy temporal hasta migrar lo ya guardado cuando vuelva la cuota.

## Valor diferencial

Reduce friccion operacional.

Una actualizacion no deberia requerir entender snapshots, indices, backfills ni cuotas Redis.

Reduce riesgo multi-tenant.

Cada operacion debe exigir tenant_id y escribir directo en tablas tenant-aware.

Reduce costo mental.

El operador debe pensar en una accion: actualizar tenant.

Reduce superficie de falla.

Si Upstash falla o no existe, el sistema debe poder seguir actualizando metricas, reviews y evidencia desde Neon.

Simplifica la arquitectura.

La fuente de verdad, la historia, la evidencia y el runtime viven en el mismo plano.

## Riesgos

Migrar todo de una vez puede romper evidencia/reviews si no se define bien el modelo Neon.

Redis todavia contiene datos utiles, especialmente snapshots historicos, reviews y evidencia cruda.

No conviene borrar Redis abruptamente mientras no exista una migracion controlada hacia Neon.

El riesgo principal es de transicion: dejar dos fuentes vivas sin regla clara de autoridad.

Regla de autoridad:

Neon es la verdad. Redis es solo fuente legacy temporal.

## Complejidad

Implementacion incremental.

Primera etapa: carga barata directa a Neon.

Segunda etapa: crear tablas Neon para snapshots, reviews y estado de captura.

Tercera etapa: carga completa directa a Neon.

Cuarta etapa: cuando Upstash libere cuota, migrar datos historicos desde Redis hacia Neon.

Quinta etapa: eliminar Redis del flujo operacional y de la documentacion principal.

No requiere redisenar el runtime base, porque el runtime ya lee place_daily_metrics en Neon.

## Impacto

Alto impacto operacional.

Permite volver a cargar CIDEF aunque Upstash este bloqueado.

Simplifica el flujo diario.

Alinea la arquitectura real con el runtime actual.

Elimina Redis como dependencia critica.

Deja el sistema mas entendible, auditable y multi-tenant.

## Dependencias

Neon debe contener el modelo completo minimo:

- places
- place_daily_metrics
- place_snapshots
- place_reviews
- capture_runs

Opcionalmente:

- review_observations
- raw_payloads jsonb

Google Places API sigue siendo necesaria para captura.

Upstash solo se necesita temporalmente para migrar lo antiguo cuando vuelva la cuota.

## Señal de éxito

Una carga barata de CIDEF debe poder ejecutarse sin tocar Redis.

Resultado esperado:

- tenant_id obligatorio
- datos escritos en Neon
- runtime_ready = true
- Redis requests = 0
- agente responde con datos nuevos desde Neon

Una carga completa debe poder guardar reviews/evidencia en Neon sin depender de Upstash.

Se considera validado cuando:

- update light Neon carga CIDEF completo
- runtime responde usando source = neon_place_daily_metrics
- update full Neon guarda reviews en tablas Neon
- Upstash puede estar caido o bloqueado sin detener el flujo operativo

## Principios de diseño

Neon es verdad operativa.

Upstash sale del camino critico.

Redis legacy no decide arquitectura futura.

tenant_id nunca tiene default silencioso.

Una accion operacional debe ser un endpoint.

La carga barata no necesita evidencia textual.

La carga completa debe guardar evidencia en Neon.

No se optimiza una arquitectura rota; se simplifica.

La solucion correcta es la que reduce pasos, no la que agrega orquestacion.
