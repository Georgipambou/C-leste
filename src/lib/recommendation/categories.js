/**
 * categories.js — Céleste
 * Liste fermée des catégories de contenu, partagée entre CategoryPicker
 * (publication) et le moteur d'affinité (user_category_affinity).
 * Liste fermée volontairement : une catégorie en texte libre est
 * inexploitable statistiquement pour le ranking.
 */
export const CONTENT_CATEGORIES = [
  { id: "humour",      label: "😂 Humour" },
  { id: "danse",       label: "💃 Danse" },
  { id: "musique",     label: "🎵 Musique" },
  { id: "beaute",      label: "💄 Beauté" },
  { id: "mode",        label: "👗 Mode" },
  { id: "challenge",   label: "🔥 Challenge" },
  { id: "sport",       label: "⚽ Sport" },
  { id: "cuisine",     label: "🍲 Cuisine" },
  { id: "bricolage",   label: "🔧 Bricolage" },
  { id: "technologie", label: "💻 Technologie" },
  { id: "animaux",     label: "🐾 Animaux" },
  { id: "voyage",      label: "✈️ Voyage" },
  { id: "education",   label: "📚 Éducation" },
  { id: "motivation",  label: "🙌 Motivation" },
  { id: "actualite",   label: "📰 Actualité" },
  { id: "art",         label: "🎨 Art" },
  { id: "gaming",      label: "🎮 Gaming" },
  { id: "nature",      label: "🌿 Nature" },
  { id: "spiritualite",label: "🙏 Spiritualité" },
  { id: "lifestyle",   label: "✨ Lifestyle" },
  { id: "debat",       label: "💬 Débat" },
  { id: "amour",       label: "❤️ Amour & relations" },
];

export const MAX_CATEGORIES_PER_POST = 3;

export const categoryLabel = (id) =>
  CONTENT_CATEGORIES.find((c) => c.id === id)?.label || id;
