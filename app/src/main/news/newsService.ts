import type { NewsItem } from "@shared/types";

const CONTENT_ORIGIN = "https://launchercontent.mojang.com";
const PATCH_NOTES_URL = `${CONTENT_ORIGIN}/v2/javaPatchNotes.json`;

export interface PatchNotesFeed {
  entries: Array<{
    id: string;
    title: string;
    version: string;
    type: string;
    date: string;
    shortText?: string;
    image?: { url?: string; title?: string };
  }>;
}

/** Pure mapper so the feed shape is testable without network access. */
export function mapPatchNotes(feed: PatchNotesFeed, limit = 12): NewsItem[] {
  return feed.entries.slice(0, limit).map((entry) => ({
    id: entry.id,
    title: entry.title,
    version: entry.version,
    category: entry.type,
    date: entry.date,
    imageUrl: entry.image?.url ? `${CONTENT_ORIGIN}${entry.image.url}` : undefined,
    shortText: entry.shortText ?? ""
  }));
}

let newsCache: { items: NewsItem[]; fetchedAt: number } | undefined;

export async function getNews(): Promise<NewsItem[]> {
  if (newsCache && Date.now() - newsCache.fetchedAt < 10 * 60_000) {
    return newsCache.items;
  }
  const response = await fetch(PATCH_NOTES_URL, {
    headers: { "User-Agent": "MonkeyPlay/0.1.0" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`News feed request failed (${response.status}).`);
  }
  const items = mapPatchNotes((await response.json()) as PatchNotesFeed);
  newsCache = { items, fetchedAt: Date.now() };
  return items;
}
