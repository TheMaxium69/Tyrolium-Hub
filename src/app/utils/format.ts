/** Date + heure lisibles selon la langue de l'interface. */
export function formatDateTime(iso: string | null | undefined, lang: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

/** Prix API (centimes) → "1 250,00 €". */
export function formatPrice(cents: number | null | undefined, lang: string): string {
  if (cents === null || cents === undefined) return '-';
  return (cents / 100).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', { style: 'currency', currency: 'EUR' });
}

/** Saisie en euros ("12,50", "12.5", "") → centimes, null si vide, NaN si invalide. */
export function parsePrice(input: string): number | null {
  const value = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!value) return null;
  const euros = Number(value);
  return Number.isFinite(euros) && euros >= 0 ? Math.round(euros * 100) : NaN;
}

/** Centimes → valeur de champ en euros ("12.50"), "" si null. */
export function priceInput(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
}
