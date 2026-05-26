# Frontend Runtime

## Estado

Arquitectura frontend oficial para NexusG Reputation Command Center.

Este documento reemplaza la aproximación inicial basada en Lovable como runtime principal.

Lovable se utilizó únicamente como prototipado visual.

El runtime final es estático, simple y conectado a una foto operacional materializada en Neon.

---

# Principio central

El frontend no es un dashboard BI.

Es una interfaz operacional reputacional.

Objetivo:

- detectar;
- priorizar;
- interpretar;
- actuar.

No existe para exploración profunda.

Existe para reducir tiempo a comprensión.

---

# Arquitectura final

## Stack

Frontend estático:

- HTML;
- CSS;
- JavaScript vanilla.

Sin:

- React;
- TanStack;
- Vite;
- SSR;
- dashboards dinámicos complejos;
- dependencias enterprise.

---

# Estructura oficial

```txt
public/
  dashboard/
    index.html
    styles.css
    app.js
```

---

# URL oficial

```txt
/dashboard/?tenant_id=sodimac
```

El tenant siempre entra por query param.

---

# Objetivo del frontend

El frontend:

- renderiza;
- prioriza visualmente;
- adapta desktop/mobile;
- consume `/api/dashboard` como proxy liviano;
- no calcula inteligencia.

No debe:

- reconstruir rankings;
- recalcular tendencias;
- recalcular red flags;
- interpretar semánticamente reviews;
- inferir prioridades.

---

# Arquitectura de datos

Flujo oficial:

```txt
Dashboard estático
→ /api/dashboard
→ tablas materializadas Neon
→ render
```

Regla precisa:

```txt
/api/dashboard no calcula inteligencia.
Solo valida tenant, consulta tablas materializadas en Neon y devuelve JSON plano.
```

El dashboard no consume cálculo runtime.

Consume una foto operacional ya materializada en Neon, expuesta por `/api/dashboard` como proxy liviano.

---

# Backend

Transporte único:

```txt
/api/dashboard
```

Ejemplo:

```txt
/api/dashboard?tenant_id=sodimac&view=full
```

`/api/dashboard` entrega:

- KPIs;
- red_flags;
- movements;
- rankings;
- executive_summary;
- mobile_priority.

Pero no los calcula.

La inteligencia operacional ya viene materializada desde la carga en Neon.

Principio:

```txt
la carga calcula, el runtime lee
```

---

# Contrato conceptual

```txt
Neon = memoria operacional
materialización = inteligencia operacional
/api/dashboard = transporte
frontend = render
agente = interpretación
```

El contrato real no es el cálculo runtime del backend.

El contrato real son las tablas/vistas materializadas en Neon.

---

# Separación desktop/mobile

No son versiones responsive del mismo dashboard.

Son:

- mismo transporte;
- misma foto operacional;
- distinta interfaz cognitiva.

---

# Desktop

## Nombre conceptual

```txt
Operational Network View
```

## Objetivo

```txt
entender el estado completo de la red
```

## Desktop optimiza

- comparación;
- distribución;
- estado global;
- rankings;
- contexto operacional.

---

# Layout desktop

## Header

- tenant;
- última actualización;
- estado operacional;
- botón agente.

---

## KPI row

Máximo 6 cards:

- nota promedio;
- tendencia;
- reviews;
- tiendas críticas;
- mayor caída;
- mejor tienda.

---

## Context row

### Izquierda

```txt
red flags
```

### Derecha

```txt
resumen ejecutivo
```

Esta es la sección central del producto.

Porque:

- detecta;
- interpreta;
- prioriza.

---

## Operational row

- mayores alzas;
- mayores bajas;
- top 5;
- bottom 5.

---

# Mobile

## Nombre conceptual

```txt
Executive Attention Radar
```

## Objetivo

```txt
entender en segundos si debo actuar
```

No optimiza exploración.

Optimiza:

- atención;
- urgencia;
- deterioro;
- prioridad.

---

# Layout mobile

## Hero principal

Debe ocupar gran parte de la pantalla.

Debe mostrar:

- nota promedio;
- deterioro;
- tiendas críticas;
- headline operacional.

Ejemplo:

```txt
4.20
↓ -0.08
7 críticas

Riesgo concentrado en Maipú y Ñuñoa.
```

---

## Acción inmediata

Cards resumidas:

- tiendas críticas;
- deterioro acelerado;
- intervención inmediata.

---

## Red flags

Cards verticales.

No tablas.

No grids.

No comparativas horizontales.

---

## FAB fijo

```txt
Abrir agente
```

Siempre visible abajo.

---

# Regla visual

```txt
texto > gráficos
```

El producto prioriza:

- claridad;
- lectura rápida;
- interpretación;
- foco operacional.

No optimiza visualización analítica compleja.

---

# Paleta visual

Tema claro.

No:

- cyberpunk;
- fondo negro extremo;
- estética gamer;
- SaaS agresivo;
- visualización tipo terminal.

Sí:

- gris claro;
- fondos suaves;
- contraste limpio;
- acentos rojo/verde;
- look ejecutivo moderno;
- alta legibilidad.

---

# Lovable

Lovable NO es runtime oficial.

Se utilizó únicamente para:

- prototipado rápido;
- validación visual;
- exploración UX.

Problemas detectados:

- estructura demasiado pesada;
- TanStack innecesario;
- routing innecesario;
- dependencias enterprise;
- mobile incorrectamente responsive;
- demasiada complejidad para el MVP.

Decisión:

extraer únicamente:

- layout;
- estilos;
- componentes útiles.

Y reescribir runtime limpio.

---

# Runtime final

Runtime oficial:

```txt
HTML + CSS + JS vanilla
```

Ventajas:

- extremadamente simple;
- barato;
- rápido;
- portable;
- fácil de mantener;
- fácil de auditar;
- sin lock-in framework.

---

# app.js

Responsabilidades:

- fetch a `/api/dashboard`;
- render desktop;
- render mobile;
- render KPIs;
- render rankings;
- render red flags;
- render summary;
- manejo de errores.

No debe:

- recalcular backend;
- inferir prioridades;
- construir narrativa semántica.

---

# styles.css

Responsabilidades:

- layout;
- responsive;
- paleta;
- spacing;
- cards;
- estados;
- mobile adaptation.

---

# index.html

Debe permanecer minimalista.

Solo:

- root container;
- css;
- app.js.

---

# Regla de runtime

El frontend siempre debe leer la foto operacional preparada.

No debe reconstruirla.

La fuente operacional oficial es Neon.

`/api/dashboard` es solo transporte seguro entre el navegador y Neon.

---

# Integración agente

Actualmente:

```txt
Abrir agente
```

abre Custom GPT.

Futuro:

cada card podrá:

- generar prompt contextual;
- copiar prompt;
- abrir agente;
- guardar ventana.

---

# Ventanas

Concepto futuro:

ventanas guardadas.

Artefactos generados:

- rankings;
- gráficos;
- tablas;
- hallazgos;
- resúmenes;
- análisis.

Deben persistirse en Neon.

No forman parte del dashboard base.

---

# Regla final

El frontend debe sentirse más cercano a:

```txt
sistema operacional reputacional
```

que a:

```txt
dashboard BI tradicional
```

El objetivo no es explorar.

El objetivo es saber:

- qué está mal;
- dónde actuar;
- qué empeora;
- qué priorizar.
