/**
 * The ways to reach the platform's support, as links the phone can open (plan §5.12.4 row 11). There is
 * one platform contact; a shop's own contact stays on its own pages. Nothing is invented: a way to reach
 * support appears only when the server sends it.
 *
 * No imports but types, so node can run this file's test directly.
 */
export interface SupportInput {
  phone?: string;
  email?: string;
  whatsapp?: string;
  url?: string;
}

export interface SupportLink {
  kind: 'phone' | 'whatsapp' | 'email' | 'web';
  label: string;
  url: string;
}

function digits(value: string): string {
  return value.replace(/[^\d]/g, '');
}

export function supportLinks(support: SupportInput | null | undefined): SupportLink[] {
  const links: SupportLink[] = [];
  if (!support) {
    return links;
  }
  if (support.phone && digits(support.phone).length >= 6) {
    const plus = support.phone.trim().startsWith('+') ? '+' : '';
    links.push({ kind: 'phone', label: 'Call', url: `tel:${plus}${digits(support.phone)}` });
  }
  if (support.whatsapp && digits(support.whatsapp).length >= 6) {
    links.push({ kind: 'whatsapp', label: 'WhatsApp', url: `https://wa.me/${digits(support.whatsapp)}` });
  }
  if (support.email) {
    links.push({ kind: 'email', label: 'Email', url: `mailto:${support.email.trim()}` });
  }
  if (support.url && /^https?:\/\/\S+$/i.test(support.url.trim())) {
    links.push({ kind: 'web', label: 'Help centre', url: support.url.trim() });
  }
  return links;
}
