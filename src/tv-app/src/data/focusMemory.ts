// Último alvo focado, para sobreviver ao reload que acompanha cada volta à frente
// (launch(self) recarrega a página — E8).
const KEY = 'home.focus.v1';

export function loadFocus(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveFocus(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
  } catch {
    // quota/indisponível: só perde a restauração
  }
}
