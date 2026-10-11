import { normalizeStringForHash } from './sanitize.js';

/**
 * Computes deterministic SHA-256 fingerprint from normalized core job attributes.
 * Prevents duplicates even if different aggregators list the same job with minor formatting differences.
 */
export async function computeJobContentHash(
  companyName: string,
  title: string,
  country: string,
  city: string
): Promise<string> {
  const normCompany = normalizeStringForHash(companyName);
  const normTitle = normalizeStringForHash(title);
  const normCountry = (country || 'CA').toUpperCase();
  const normCity = normalizeStringForHash(city);

  const rawFingerprint = `${normCompany}|${normTitle}|${normCountry}|${normCity}`;
  const data = new TextEncoder().encode(rawFingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
