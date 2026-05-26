const TENANTS = {
  sodimac: {
    tenant_name: "Sodimac",
    industry: "home_improvement",
    total_reviews: 18420,
    reviews_delta: 386,
    avg: 4.2,
    delta: -0.08,
    critical: 7,
    locations: ["Maipú", "Ñuñoa", "Constructor RM"],
    brand_prefix: "Sodimac"
  },
  cidef: {
    tenant_name: "CIDEF",
    industry: "automotive",
    total_reviews: 9210,
    reviews_delta: 128,
    avg: 4.34,
    delta: 0.03,
    critical: 3,
    locations: ["La Florida", "Santiago", "Puente Alto"],
    brand_prefix: "CIDEF"
  },
  beauty_plus: {
    tenant_name: "Beauty Plus",
    industry: "beauty_retail",
    total_reviews: 3740,
    reviews_delta: 74,
    avg: 4.48,
    delta: -0.02,
    critical: 2,
    locations: ["Costanera", "Vespucio", "La Serena"],
    brand_prefix: "Beauty Plus"
  }
};

export const ALLOWED_TENANTS = Object.keys(TENANTS);

function store(tenant, location, rating, delta, extra = {}) {
  const cfg = TENANTS[tenant];
  return {
    place_id: `${tenant}_${location.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    name: `${cfg.brand_prefix} ${location}`,
    location,
    rating,
    delta,
    review_count: extra.review_count ?? 320,
    severity: extra.severity ?? "medium",
    reason: extra.reason ?? "Movimiento relevante frente al período anterior"
  };
}

export function getMockDashboard(tenant_id) {
  const cfg = TENANTS[tenant_id];
  if (!cfg) return null;

  const redFlags = [
    store(tenant_id, cfg.locations[0], 3.6, -0.22, {
      review_count: 1140,
      severity: "high",
      reason: "Riesgo actual: baja nota + alto volumen de reviews"
    }),
    store(tenant_id, cfg.locations[1], 3.8, -0.03, {
      review_count: 860,
      severity: "high",
      reason: "Riesgo estructural: bajo 4.0 sostenido"
    }),
    store(tenant_id, cfg.locations[2], 3.9, 0.01, {
      review_count: 640,
      severity: "medium",
      reason: "Riesgo actual: bajo umbral reputacional"
    })
  ];

  const up = [
    store(tenant_id, "Las Condes", 4.7, 0.18, { review_count: 420, severity: "low", reason: "Mejora sostenida" }),
    store(tenant_id, "Temuco", 4.6, 0.12, { review_count: 380, severity: "low", reason: "Alza relevante" }),
    store(tenant_id, "La Florida", 4.5, 0.09, { review_count: 510, severity: "low", reason: "Recuperación reciente" })
  ];

  const down = [
    store(tenant_id, cfg.locations[0], 3.6, -0.22, {
      review_count: 1140,
      severity: "high",
      reason: "Mayor caída reciente + alto volumen de reviews"
    }),
    store(tenant_id, "Osorno", 4.05, -0.17, {
      review_count: 260,
      severity: "medium",
      reason: "Caída reciente relevante, aún cerca del umbral"
    }),
    store(tenant_id, "San Bernardo", 4.0, -0.13, {
      review_count: 450,
      severity: "medium",
      reason: "Caída reciente con riesgo de entrar a zona crítica"
    })
  ];

  return {
    ok: true,
    source: "mock",
    tenant_id,
    tenant_name: cfg.tenant_name,
    industry: cfg.industry,
    updated_at: new Date().toISOString(),
    period: {
      current_date: new Date().toISOString().slice(0, 10),
      comparison_label: "vs. período anterior"
    },
    kpis: {
      average_rating: cfg.avg,
      rating_delta: cfg.delta,
      total_reviews: cfg.total_reviews,
      reviews_delta: cfg.reviews_delta,
      critical_stores: cfg.critical,
      worst_drop: down[0],
      best_store: up[0]
    },
    executive_summary: {
      facts: [
        `rating=${cfg.avg}`,
        `rating_delta=${cfg.delta}`,
        `critical_stores=${cfg.critical}`,
        `main_risk_locations=${cfg.locations.join(", ")}`
      ],
      desktop_hint: `Riesgo actual concentrado en ${cfg.locations[0]} y ${cfg.locations[1]}. La mayor caída reciente aparece en ${down[0].location}.`,
      mobile_hint: `${cfg.locations[0]} y ${cfg.locations[1]} requieren atención.`
    },
    mobile_priority: {
      headline: `Riesgo concentrado en ${cfg.locations[0]} y ${cfg.locations[1]}.`,
      critical_count: cfg.critical,
      accelerating_count: Math.min(3, cfg.critical),
      immediate_action_count: Math.min(2, cfg.critical)
    },
    red_flags: redFlags.map((item, index) => ({ rank: index + 1, ...item })),
    movements: {
      up: up.map((item, index) => ({ rank: index + 1, ...item })),
      down: down.map((item, index) => ({ rank: index + 1, ...item }))
    },
    rankings: {
      top: [
        up[0],
        up[1],
        store(tenant_id, "Vitacura", 4.55, 0.04, { review_count: 295, severity: "low", reason: "Buen desempeño" }),
        up[2],
        store(tenant_id, "Providencia", 4.45, 0.02, { review_count: 360, severity: "low", reason: "Sobre promedio" })
      ].map((item, index) => ({ rank: index + 1, ...item })),
      bottom: [
        redFlags[0],
        redFlags[1],
        redFlags[2],
        store(tenant_id, "San Bernardo", 4.0, -0.13, { review_count: 450, severity: "medium", reason: "Cerca de umbral crítico" }),
        store(tenant_id, "Osorno", 4.05, -0.17, { review_count: 260, severity: "medium", reason: "Deterioro reciente" })
      ].map((item, index) => ({ rank: index + 1, ...item }))
    }
  };
}
