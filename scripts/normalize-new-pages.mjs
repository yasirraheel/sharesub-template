import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('Sharesub');
const pages = [
  'en/dashboard.html',
  'en/my-shared-subscriptions.html',
  'en/joined-subscriptions.html',
  'en/waiting-list.html',
  'en/my-wallet.html',
  'en/my-cards.html',
  'en/my-account.html',
  'en/my-settings.html',
  'en/my-chat/subscriptions.html',
];

const routeMap = new Map([
  ['/en', '/en/index.html'],
  ['/en/', '/en/index.html'],
  ['/en/subscriptions', '/en/subscriptions.html'],
  ['/en/subscriptions/house', '/en/subscriptions/house.html'],
  ['/en/brand/amazon', '/en/brand/amazon.html'],
  ['/en/register', '/en/register.html'],
  ['/en/userlogin', '/en/userlogin.html?demo=1'],
  ['/en/logout', '/en/userlogin.html?logout=1'],
  ['/en/dashboard', '/en/dashboard.html'],
  ['/en/my-shared-subscriptions', '/en/my-shared-subscriptions'],
  ['/en/joined-subscriptions', '/en/joined-subscriptions'],
  ['/en/waiting-list', '/en/waiting-list.html'],
  ['/en/my-wallet', '/en/my-wallet.html'],
  ['/en/my-cards', '/en/my-cards.html'],
  ['/en/my-account', '/en/my-account.html'],
  ['/en/my-settings', '/en/my-settings.html'],
  ['/en/my-chat/subscriptions', '/en/my-chat/subscriptions'],
  ['/en/my-documents', '/en/my-account.html'],
]);

const localAsset = (value) => /^\/(?:css|js|img|images|fonts|favicon|cms\/wp-content|cms\/wp-includes)\//i.test(value);

const mapPath = (value) => {
  const match = value.match(/^([^?#]*)([?#].*)?$/);
  const base = match?.[1] || value;
  const suffix = match?.[2] || '';
  const mapped = routeMap.get(base);
  if (mapped) return mapped + (suffix && !mapped.includes('?') ? suffix : '');
  return null;
};

const normalizeValue = (value, attr) => {
  if (/^(?:data:|#|mailto:|tel:|javascript:)/i.test(value)) return value;

  let localValue = value;
  const sameSite = localValue.match(/^https?:\/\/www\.sharesub\.com(\/[^?#]*)?([?#].*)?$/i);
  if (sameSite) localValue = `${sameSite[1] || '/'}${sameSite[2] || ''}`;
  else if (/^https?:\/\//i.test(localValue) || /^\/\//.test(localValue)) return attr === 'src' ? '' : '#offline';

  if (attr === 'src' && /\/js\/app\.js(?:\?|$)/i.test(localValue)) return '/js/app.js';
  if (attr === 'href' && /\/css\/app\.css(?:\?|$)/i.test(localValue)) return '/css/app.css?id=d5e0988';
  if (/^\/(?:en|cms\/en)\/[^?#]+\.html(?:[?#]|$)/i.test(localValue)) return localValue;

  const mapped = mapPath(localValue);
  if (mapped) return mapped;
  if (localAsset(localValue)) return localValue;
  if (localValue.startsWith('/')) return attr === 'src' ? '' : '#offline';
  return value;
};

for (const relative of pages) {
  const file = path.join(root, relative);
  let html = await fs.readFile(file, 'utf8');

  // Remove captured analytics, consent, challenge, and other network-only scripts.
  html = html.replace(/\s*<script\b([^>]*)src=["']([^"']+)["'][\s\S]*?<\/script>/gi, (full, attrs, source) => {
    const cleaned = normalizeValue(source, 'src');
    return cleaned ? full.replace(source, cleaned) : '';
  });
  html = html.replace(/\s*<iframe\b[^>]*src=["']https?:\/\/[^"']+["'][\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/\s*<script\b(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi, (full, body) =>
    /googletagmanager|cookiebot|cloudflareinsights|facebook\.net|intercom/i.test(body) ? '' : full);
  html = html.replace(/\s*<link\b([^>]*)href=["']([^"']+)["'][^>]*>/gi, (full, attrs, href) => {
    const cleaned = normalizeValue(href, 'href');
    return cleaned && cleaned !== '#offline' ? full.replace(href, cleaned) : '';
  });

  // Restore the captured dashboard navigation links that were saved as placeholders.
  html = html.replace(/<a\b[^>]*href=["']#offline["'][^>]*>[\s\S]*?<\/a>/gi, (anchor) => {
    const label = anchor.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
    const destination = /aria-label=["']Syndicate/i.test(anchor) ? '/en/index.html'
      : /aria-label=["']Items to Resolve/i.test(anchor) ? '/en/dashboard.html'
      : /Shared subscriptions/i.test(label) ? '/en/my-shared-subscriptions'
      : /Joined subscriptions|See my expenses/i.test(label) ? '/en/joined-subscriptions'
      : /\b(?:Subscriptions|Browse subscriptions|See all subscriptions)\b/i.test(label) ? '/en/subscriptions.html'
      : /\bBlog\b/i.test(label) ? '/cms/en/index.html'
      : /\bChat\b|Messages as a priority/i.test(label) ? '/en/my-chat/subscriptions'
      : /\bDashboard\b|My account|My Account/i.test(label) ? '/en/dashboard.html'
      : /Waiting List/i.test(label) ? '/en/waiting-list.html'
      : /See my wallet|\bWallet\b/i.test(label) ? '/en/my-wallet.html'
      : /Means of payment|Add a payment method/i.test(label) ? '/en/my-cards.html'
      : /Identity|My Account Information/i.test(label) ? '/en/my-account.html'
      : /Preferences/i.test(label) ? '/en/my-settings.html'
      : /Logout/i.test(label) ? '/en/userlogin.html?logout=1'
      : /Join a subscription/i.test(label) ? '/en/subscriptions.html'
      : /Create subscription|Propose a subscription/i.test(label) ? '/en/register.html'
      : null;
    return destination ? anchor.replace(/href=["']#offline["']/i, `href="${destination}"`) : anchor;
  });
  html = html
    .replace(/(href=["'])\/en\/subscriptions\.html(["'][^>]*>\s*Shared subscriptions)/gi, '$1/en/my-shared-subscriptions$2')
    .replace(/(href=["'])\/en\/subscriptions\.html(["'][^>]*>\s*Joined subscriptions)/gi, '$1/en/joined-subscriptions$2');

  // Some captured desktop dashboard sidebars label Chat correctly but carry
  // the Dashboard href. Keep the visible Chat item on its supplied route.
  html = html.replace(/<a\b([^>]*class=["'][^"']*navi_dash-link[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs, body) => {
    if (!/navi_dash-text[\s\S]*?\bChat\b/i.test(body)) return full;
    return full.replace(/href=["'][^"']*["']/i, 'href="/en/my-chat/subscriptions"');
  });

  html = html.replace(/\b(href|action|src|poster|value)=(['"])([^'"]*)\2/gi, (match, attr, quote, value) => {
    const cleaned = normalizeValue(value, attr.toLowerCase());
    return cleaned ? `${attr}=${quote}${cleaned}${quote}` : `${attr}=${quote}#offline${quote}`;
  });
  html = html.replace(/window\.check_chat_url\s*=\s*["'][^"']+["'];?/gi, 'window.check_chat_url = null;');

  await fs.writeFile(file, html, 'utf8');
}

console.log(`Normalized ${pages.length} local authenticated pages.`);
