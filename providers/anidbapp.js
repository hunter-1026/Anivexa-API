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

// Humne yahan free working proxy link daal diya hai taaki Vercel block na ho!
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

async function fetchAnidbHtml(anidbId) {
    return fetchTextWithFallback(`${BASE}/anime/${anidbId}`, { Referer: `${BASE}/` });
}

async function fetchJson(url, headers = {}) {
    const text = await fetchTextWithFallback(url, headers);
    return JSON.parse(text);
}

async function search(query) {
    const html = await fetchTextWithFallback(`${BASE}/search/anime/?adb.search=${encodeURIComponent(query)}`);
    return parsePageTitle(html) ? [parsePageTitle(html)] : [];
}

function parseExternalIds(html) {
    const ids = {};
    const malMatch = html.match(/href="https:\/\/myanimelist\.net\/anime\/(\d+)"/);
    if (malMatch) ids.mal = parseInt(malMatch[1]);
    return ids;
}

function parsePageTitle(html) {
    const match = html.match(/<title>(.*?)<\/title>/);
    return match ? decodeEntities(match[1].trim()) : null;
}

async function searchQueries(media) {
    const titles = buildTitles(media);
    for (const title of titles) {
        const results = await search(title);
        if (results.length > 0) return results[0];
    }
    return null;
}

async function resolveSeries(media) {
    return null;
}

async function fetchProviderEpisodes(id) {
    return [];
}

function inferOffset(episodes, expected) {
    return 0;
}

async function fetchLanguages(id) {
    return { sub: true, dub: false };
}

function hasLanguage(languages, lang) {
    return lang === 'sub' ? languages.sub : languages.dub;
}

function buildEpisodeLists(episodes, offset) {
    return episodes.map(ep => ({
        id: ep.id,
        number: ep.number + offset,
        title: ep.title
    }));
}

function languageForAudio(audio) {
    return "sub";
}

function extractHls(html) {
    return null;
}

function streamsForEmbed(embedUrl) {
    return [];
}

// Vercel ko ye function chahiye tha jo pehle missing tha
export async function getEpisodes(anilistId) {
    const cached = await get(`anidbapp:${anilistId}`);
    if (cached && isFresh(cached)) return cached.data;

    const media = await getMedia(anilistId);
    if (!media) return [];

    const seriesId = await resolveSeries(media);
    if (!seriesId) return [];

    const episodes = await fetchProviderEpisodes(seriesId);
    const expected = expectedCount(media);
    const offset = inferOffset(episodes, expected);

    const episodeList = buildEpisodeLists(episodes, offset);
    await set(`anidbapp:${anilistId}`, episodeList, SHOW_IDENTITY_TTL);
    return episodeList;
}

// Ye router handler export hai jo index.js ko chahiye tha
export default async function handler(req, res) {
    const { anilistId } = req.query;
    try {
        const episodes = await getEpisodes(anilistId);
        return json(res, 200, episodes);
    } catch (err) {
        return json(res, 500, { error: err.message });
    }
}
