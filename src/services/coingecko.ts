interface PriceData {
  bitcoin: { usd: number; usd_24h_change: number };
  ethereum: { usd: number; usd_24h_change: number };
  monad: { usd: number; usd_24h_change: number };
}

interface CacheEntry {
  data: PriceData;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

let cache: CacheEntry | null = null;

const FALLBACK_DATA: PriceData = {
  bitcoin: { usd: 96_432.18, usd_24h_change: 2.34 },
  ethereum: { usd: 3_241.56, usd_24h_change: -0.87 },
  monad: { usd: 0.42, usd_24h_change: 15.23 },
};

export async function getMarketData(): Promise<{
  prices: PriceData;
  cached: boolean;
  fetchedAt: number;
}> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { prices: cache.data, cached: true, fetchedAt: cache.fetchedAt };
  }

  try {
    const url = `${COINGECKO_API}/simple/price?ids=bitcoin,ethereum,monad&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);

    const raw = await res.json();

    const data: PriceData = {
      bitcoin: {
        usd: raw.bitcoin?.usd ?? FALLBACK_DATA.bitcoin.usd,
        usd_24h_change: raw.bitcoin?.usd_24h_change ?? 0,
      },
      ethereum: {
        usd: raw.ethereum?.usd ?? FALLBACK_DATA.ethereum.usd,
        usd_24h_change: raw.ethereum?.usd_24h_change ?? 0,
      },
      monad: {
        usd: raw.monad?.usd ?? FALLBACK_DATA.monad.usd,
        usd_24h_change: raw.monad?.usd_24h_change ?? 0,
      },
    };

    cache = { data, fetchedAt: Date.now() };
    return { prices: data, cached: false, fetchedAt: cache.fetchedAt };
  } catch (err) {
    console.warn('[CoinGecko] Fetch failed, serving fallback:', err instanceof Error ? err.message : err);
    const now = Date.now();
    cache = { data: FALLBACK_DATA, fetchedAt: now };
    return { prices: FALLBACK_DATA, cached: false, fetchedAt: now };
  }
}
