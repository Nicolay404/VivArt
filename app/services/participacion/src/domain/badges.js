/**
 * Lógica de dominio de insignias de rutas culturales (spec 007, US3).
 */

export function presentarInsignia(ubadge, ruta = null) {
  return {
    id: ubadge.id,
    routeId: ubadge.route_id,
    routeTitle: ruta?.title ?? ubadge.route_title ?? null,
    title: ruta?.badge_title ?? ubadge.badge_title,
    description: ruta?.badge_description ?? ubadge.badge_description,
    icon: ruta?.badge_icon ?? ubadge.badge_icon,
    color: ruta?.badge_color ?? ubadge.badge_color,
    unlockedAt: ubadge.unlocked_at,
    stampCountAtUnlock: ubadge.stamp_count_at_unlock,
  };
}

export function presentarInsigniaDesbloqueada(ubadge, ruta) {
  return {
    id: ubadge.id,
    routeId: ruta.id,
    routeTitle: ruta.title,
    title: ruta.badge_title,
    description: ruta.badge_description,
    icon: ruta.badge_icon,
    color: ruta.badge_color,
  };
}
