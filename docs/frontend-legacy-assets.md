# Frontend Legacy Assets

## Estado

El frontend de `/dashboard` fue reemplazado por el **Operational Pressure Board**.

La vista activa ya no importa los assets legacy del dashboard anterior.

## Vista activa

Archivos activos para `/dashboard`:

```txt
public/dashboard/index.html
public/dashboard/config.js
public/dashboard/app.js
public/dashboard/operational-pressure.js
public/dashboard/pressure-board.css
```

## Assets legacy

Estos archivos quedan en repo como referencia temporal o fallback histórico:

```txt
public/dashboard/styles.css
public/dashboard/components.css
public/dashboard/components.js
public/dashboard/utils.js
```

## Regla

No volver a importar estos archivos en `/dashboard` sin una decisión explícita.

La vista nueva debe evolucionar en:

```txt
operational-pressure.js
pressure-board.css
```

## Motivo

El dashboard anterior mezclaba:

- KPIs
- rankings
- tarjetas clásicas
- resumen ejecutivo
- alertas cualitativas
- helpers compartidos

Eso no representa la nueva dirección del producto.

La nueva interfaz busca:

- señales activas
- superficie operacional
- mapa de presión
- compresión ejecutiva
- máximo 12 prioridades visibles

## Política de eliminación

No borrar todavía.

Eliminar solo cuando se cumplan estas condiciones:

1. `/dashboard` lleva al menos 2 iteraciones funcionando sin usar legacy.
2. No existe otra ruta pública que dependa de estos archivos.
3. Se revisó que no haya imports activos en `index.html` ni referencias directas.

Hasta entonces, mantenerlos como legacy explícito.
