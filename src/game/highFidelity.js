export const HIGH_FIDELITY = {
  target: 'mobile-high-fidelity',
  renderer: {
    antialias: true,
    shadows: true,
    shadowMap: 2048,
    dynamicLighting: true,
    metallicMaterials: true,
    emissiveNeon: true,
  },
  artDirection: {
    era: '2026',
    theme: 'premium sci-fi hunter',
    ui: 'tactical-glass',
    palette: ['#05070d', '#00e5c0', '#ff7a2f', '#7c5cff'],
  },
};

export const VISUAL_LAYERS = [
  'skybox', 'terrain', 'structures', 'neon-signals', 'particles',
  'players', 'robots', 'weapons', 'effects', 'hud', 'minimap',
];
