import { getMedia } from "../core/anilist.js";
import {
    attr,
    buildTitles,
    decodeEntities,
    episodeMeta,
    expectedCount,
    json,
    stripTags,
} from "../core/new-provider-utils.js";
import { get, set, isFresh, SHOW_IDENTITY_TTL } from "../core/smartcache.js";

const BASE = "https://anidb.app";

// Bhai, humne yahan free working proxy link daal diya hai!
const PROXY = "https://cors-anywhere.herokuapp.com/";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchTextWithFallback(url, headers = {}) {
    const merged = {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...headers,
    };

    const direct = await fetch(url, { headers: merged }).catch(() => null);
    if (direct?.ok) return direct.text();

    const ref = headers.Referer ?? `${BASE}/`;
    
    // Proxy ke sath call karne ka sahi tarika
    const proxied = await fetch(`${PROXY}${url}`, {
        headers: { "User-Agent": UA, Accept: merged.Accept },
    }).catch(() => null);

    if (proxied?.ok) return proxied.text();
    throw new Error(`HTTP ${direct?.status ?? proxied?.status ?? "failed"} fetching ${url}`);
}
