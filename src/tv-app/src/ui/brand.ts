// Tiles de texto para apps cujo ícone não carrega ou é genérico (medido no device,
// 2026-11-07): Netflix e Prime falham ao carregar; YouTube entrega o ícone padrão do
// Tizen. Só nome + cor — nenhum logo de terceiro é reproduzido.
export interface BrandTile {
  text: string;
  bg: string;
  fg: string;
}

export const BRAND_TILES: Readonly<Record<string, BrandTile>> = {
  'org.tizen.netflix-app': { text: 'Netflix', bg: '#141414', fg: '#e50914' },
  'org.tizen.primevideo': { text: 'Prime Video', bg: '#0f171e', fg: '#1a98ff' },
  '9Ur5IzDKqV.TizenYouTube': { text: 'YouTube', bg: '#ff0033', fg: '#ffffff' },
};
