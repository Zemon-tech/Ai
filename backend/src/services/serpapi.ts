import { env } from '../config/env';
import { setTimeout as delay } from 'timers/promises';

export type WebResult = {
  title: string;
  link: string;
  snippet?: string;
  source?: string;
  date?: string;
};

const TRUSTED_TLDS = ['.gov', '.edu'];
const TRUSTED_DOMAINS = [
  'www.nature.com',
  'www.sciencedirect.com',
  'arxiv.org',
  'www.nhs.uk',
  'www.mayoclinic.org',
  'www.bmj.com',
  'www.nytimes.com',
  'www.bbc.com',
  'www.who.int',
  'www.cdc.gov',
  'www.whitehouse.gov',
  'data.gov',
  'developer.mozilla.org',
  'docs.python.org',
  'nodejs.org',
  'khanacademy.org',
  'stanford.edu',
  'mit.edu',
];

function isTrusted(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (TRUSTED_TLDS.some((tld) => host.endsWith(tld))) return true;
    if (TRUSTED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return true;
    return false;
  } catch {
    return false;
  }
}

type BaseOpts = { num?: number; gl?: string; hl?: string; start?: number; tbs?: string; location?: string };

async function callSerp(params: Record<string, string>) {
  if (!env.SERPAPI_KEY) return null;
  const search = new URLSearchParams({ api_key: env.SERPAPI_KEY, no_cache: 'true', ...params });
  const url = `https://serpapi.com/search?${search.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'QuildAI/1.0 (+https://quild.ai)' } });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

function normalizeOrganic(organic: any[]): WebResult[] {
  const results: WebResult[] = (organic || [])
    .map((r: any) => ({
      title: String(r.title || ''),
      link: String(r.link || ''),
      snippet: (r.snippet || r.snippet_highlighted_words?.join(' ')) as string | undefined,
      date: (r.date || r.date_published || r.snippet_date) as string | undefined,
      source: (() => {
        try { return new URL(r.link).hostname; } catch { return undefined; }
      })(),
    }))
    .filter((r: WebResult) => {
      try {
        if (!r.title || !r.link) return false;
        if (r.link.toLowerCase().includes('blocked')) return false;
        const u = new URL(r.link);
        if (!/^https?:$/.test(u.protocol)) return false;
        return !!u.hostname;
      } catch {
        return false;
      }
    });
  const trusted = results.filter((r) => isTrusted(r.link));
  return (trusted.length ? trusted : results).slice(0, 10);
}

export async function serpGoogleLightSearch(query: string, opts?: BaseOpts) {
  const data = await callSerp({
    engine: 'google_light',
    q: query,
    num: String(opts?.num ?? 10),
    gl: opts?.gl ?? 'ind',
    hl: opts?.hl ?? 'en',
    start: String(opts?.start ?? 0),
    ...(opts?.tbs ? { tbs: opts.tbs } : {}),
    ...(opts?.location ? { location: opts.location } : {}),
  });
  if (!data) return [] as WebResult[];
  const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
  return normalizeOrganic(organic);
}

export async function serpGoogleNewsLightSearch(query: string, opts?: BaseOpts) {
  const data = await callSerp({
    engine: 'google_news_light',
    q: query,
    num: String(opts?.num ?? 10),
    gl: opts?.gl ?? 'ind',
    hl: opts?.hl ?? 'en',
    start: String(opts?.start ?? 0),
    ...(opts?.tbs ? { tbs: opts.tbs } : {}),
    ...(opts?.location ? { location: opts.location } : {}),
  });
  if (!data) return [] as WebResult[];
  const news = Array.isArray(data?.news_results) ? data.news_results : Array.isArray(data?.organic_results) ? data.organic_results : [];
  return normalizeOrganic(news);
}

// Backward-compatible default search using standard Google engine
export async function serpSearch(query: string, opts?: { num?: number; gl?: string; hl?: string }) {
  const data = await callSerp({
    engine: 'google',
    q: query,
    num: String(opts?.num ?? 10),
    gl: opts?.gl ?? 'ind',
    hl: opts?.hl ?? 'en',
  });
  if (!data) return [] as WebResult[];
  const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
  return normalizeOrganic(organic).slice(0, 8);
}

export function renderCitations(results: WebResult[]): string {
  if (!results.length) return '';
  const lines = results.slice(0, 5).map((r, i) => `(${i + 1}) ${r.title} — ${r.source || r.link}`);
  return `\n\nWeb sources (use carefully):\n${lines.join('\n')}`;
}

// Fetch and extract main textual content from a page with basic security controls
export async function fetchMainText(url: string, opts?: { timeoutMs?: number; maxBytes?: number }): Promise<string | null> {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(3000, Math.min(opts?.timeoutMs ?? 12000, 30000));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'QuildAI/1.0 (+https://quild.ai) content-fetch',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!/text\/html|application\/(xhtml\+xml|xml)/i.test(ct)) return null;
    const maxBytes = Math.max(50_000, Math.min(opts?.maxBytes ?? 400_000, 1_000_000));
    const buf = await res.text();
    let html = buf.slice(0, maxBytes);
    // Remove scripts/styles and comments
    html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
               .replace(/<style[\s\S]*?<\/style>/gi, ' ')
               .replace(/<!--([\s\S]*?)-->/g, ' ');
    // Prefer content inside <article> if present
    const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
    const body = articleMatch ? articleMatch[0] : (html.match(/<body[\s\S]*?<\/body>/i)?.[0] || html);
    // Convert some block tags to newlines, strip the rest
    const withBlocks = body
      .replace(/<\/(p|div|section|br|li|h\d)>/gi, '\n')
      .replace(/<li>/gi, '- ');
    const text = withBlocks.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    // Heuristic: return first ~2400-4000 chars to provide richer context
    return text.slice(0, 4000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    // small jitter to avoid hammering
    await delay(1);
  }
}

export async function fetchTopArticlesText(urls: string[], limit = 5): Promise<(string | null)[]> {
  const unique: string[] = [];
  for (const url of urls) {
    try {
      const u = new URL(url);
      const key = `${u.hostname}${u.pathname}`;
      if (!unique.find((x) => x === key)) unique.push(url);
    } catch { continue; }
    if (unique.length >= limit) break;
  }
  const results: (string | null)[] = [];
  for (const url of unique) {
    // sequential to be gentle; can be parallelized with a small pool if needed
    const text = await fetchMainText(url);
    results.push(text);
  }
  return results;
}
