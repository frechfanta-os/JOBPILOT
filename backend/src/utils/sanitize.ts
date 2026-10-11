/**
 * Text and HTML sanitization utilities for external job data.
 * Protects against XSS, injected HTML, and excessively long text payloads.
 */

/**
 * Strips all HTML tags and unescapes basic HTML entities.
 * Returns safe, normalized plain text.
 */
export function sanitizeHtmlToPlainText(html: string): string {
  if (!html) return '';

  let text = html
    // Remove script and style elements with their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Replace breaks and paragraphs with newlines
    .replace(/<(?:br|\/p|\/div|\/li|h[1-6])\b[^>]*>/gi, '\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&euro;/gi, '€')
    .replace(/&pound;/gi, '£');

  // Collapse multiple newlines and trim whitespace
  text = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');

  return text;
}

/**
 * Creates a clean, safe summary snippet (max 300 characters).
 */
export function createSummarySnippet(text: string, maxLength = 300): string {
  const clean = sanitizeHtmlToPlainText(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength).trim() + '...';
}

/**
 * Normalizes string for deduplication fingerprinting.
 * Lowercases, strips punctuation and extra whitespace.
 */
export function normalizeStringForHash(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
