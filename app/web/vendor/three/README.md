# Three.js 0.170.0

Biblioteca 3D para la maqueta del Mapa (`app/web/js/mapa-3d.js`). Se sirve desde aquí porque la CSP de la web
(`default-src 'self'`) no permite cargar scripts de un CDN.

- `three.module.min.js`: copia sin cambios de `build/three.module.min.js` del paquete npm `three@0.170.0`.
- `OrbitControls.js`: `examples/jsm/controls/OrbitControls.js` del mismo paquete, con un solo cambio: importa
  `./three.module.min.js` en lugar de `'three'` (la web no usa mapas de importación).
- Licencia MIT: ver `LICENSE`.

Para actualizar, se reemplazan los dos archivos con los de la nueva versión y se repite el cambio del import.
