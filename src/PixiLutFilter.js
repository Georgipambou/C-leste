// PixiLutFilter.js
// Technique de LUT (Look-Up Table) 512×512 / grille 8×8 de tuiles 64×64,
// adaptée du shader GPUImageLookupFilter (Brad Larson et al., licence BSD-3,
// voir https://github.com/BradLarson/GPUImage — LICENSE conservée ci-dessous).
//
// Contrairement aux filtres CSS devinés à la main ou aux presets
// ColorMatrixFilter de Pixi, une LUT reproduit une vraie table de
// correspondance couleur (comme les filtres Instagram historiques) —
// résultat beaucoup plus fin, et surtout IDENTIQUE qu'on l'applique en
// direct caméra ou lors de l'export, puisque c'est le même filtre Pixi
// dans les deux cas.
//
// Licence GPUImage (BSD-3) :
// Copyright (c) 2012, Brad Larson, Ben Cochran, Hugues Lismonde,
// Keitaroh Kobayashi, Alaric Cole, Matthew Clark, Jacob Gundersen, Chris Williams.
// Redistribution et usage autorisés sous licence BSD-3-Clause.

import * as PIXI from "pixi.js";

const fragmentShader = `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;      // image source (fournie par Pixi)
uniform sampler2D uLookup;       // texture LUT 512x512
uniform float uIntensity;        // 0 = image originale, 1 = LUT pleine

void main() {
  vec4 textureColor = texture2D(uSampler, vTextureCoord);

  float blueColor = textureColor.b * 63.0;

  vec2 quad1;
  quad1.y = floor(floor(blueColor) / 8.0);
  quad1.x = floor(blueColor) - (quad1.y * 8.0);

  vec2 quad2;
  quad2.y = floor(ceil(blueColor) / 8.0);
  quad2.x = ceil(blueColor) - (quad2.y * 8.0);

  vec2 texPos1;
  texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.r);
  texPos1.y = (quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.g);

  vec2 texPos2;
  texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.r);
  texPos2.y = (quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * textureColor.g);

  vec4 newColor1 = texture2D(uLookup, texPos1);
  vec4 newColor2 = texture2D(uLookup, texPos2);

  vec4 newColor = mix(newColor1, newColor2, fract(blueColor));
  gl_FragColor = mix(textureColor, vec4(newColor.rgb, textureColor.w), uIntensity);
}
`;

// Vertex shader par défaut de Pixi (on garde celui fourni par le framework,
// pas besoin de le réécrire — PIXI.Filter utilise un vertex par défaut si
// on ne passe que le fragment... mais pour être explicite sur les versions
// récentes de pixi.js, on le fournit quand même) :
const vertexShader = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;

void main(void) {
  gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
  vTextureCoord = aTextureCoord;
}
`;

export class LutFilter extends PIXI.Filter {
  constructor(lutTexture, intensity = 1.0) {
    super(vertexShader, fragmentShader, {
      uLookup: lutTexture,
      uIntensity: intensity,
    });
  }

  set intensity(v) {
    this.uniforms.uIntensity = v;
  }
  get intensity() {
    return this.uniforms.uIntensity;
  }
}

// Cache pour éviter de recharger la même texture LUT à chaque changement de filtre.
const lutCache = new Map();

export function loadLutTexture(url) {
  if (lutCache.has(url)) return lutCache.get(url);
  const tex = PIXI.Texture.from(url);
  lutCache.set(url, tex);
  return tex;
}

// Déclare tes filtres ici, en pointant vers les PNG copiés dans /public/luts/.
// "id" doit correspondre à ce que tu utilises déjà dans ton state `filter`.
export const LUT_FILTERS = [
  { id: "normal",       label: "Original",   lut: null },
  { id: "amatorka",     label: "Amatorka",   lut: "/luts/lookup_amatorka.png" },
  { id: "etikate",      label: "Miss Étikate", lut: "/luts/lookup_miss_etikate.png" },
  { id: "elegance1",    label: "Élégance",   lut: "/luts/lookup_soft_elegance_1.png" },
  { id: "elegance2",    label: "Douceur",    lut: "/luts/lookup_soft_elegance_2.png" },
  { id: "light",        label: "Lumière",    lut: "/luts/lookup_light.png" },
];

// Utilitaire : construit (ou récupère) le filtre Pixi correspondant à un id.
const filterInstanceCache = new Map();
export function getLutFilter(id) {
  if (id === "normal" || !id) return null;
  if (filterInstanceCache.has(id)) return filterInstanceCache.get(id);
  const def = LUT_FILTERS.find((f) => f.id === id);
  if (!def || !def.lut) return null;
  const tex = loadLutTexture(def.lut);
  const f = new LutFilter(tex, 1.0);
  filterInstanceCache.set(id, f);
  return f;
}