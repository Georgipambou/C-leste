// Confirmation globale (remplace window.confirm) — extraite dans son propre
// module pour être utilisable à la fois par App.jsx et par les composants
// enfants (FeedViewer, etc.) qui ne peuvent pas importer App.jsx (import circulaire).
// Usage: if(!(await confirmAction("Supprimer ce message ?")))return;
// Avec sous-texte: confirmAction("Désactiver votre compte ?",{detail:"Cette action est irréversible.",confirmLabel:"Désactiver"})
const _confirmResolvers = new Map();
let _confirmIdSeq = 0;

export function confirmAction(message, opts = {}) {
  return new Promise(resolve => {
    const id = ++_confirmIdSeq;
    _confirmResolvers.set(id, resolve);
    window.dispatchEvent(new CustomEvent("celeste_confirm_open", { detail: { id, message, ...opts } }));
  });
}

export function resolveConfirmAction(id, result) {
  const resolve = _confirmResolvers.get(id);
  if (resolve) { resolve(result); _confirmResolvers.delete(id); }
}