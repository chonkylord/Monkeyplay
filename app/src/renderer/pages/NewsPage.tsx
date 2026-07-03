import type { NewsItem } from "@shared/types";

interface NewsPageProps {
  news: NewsItem[];
}

export function NewsPage({ news }: NewsPageProps) {
  return (
    <div className="page" id="news">
      <div className="page-head">
        <h1>Minecraft News</h1>
        <span className="page-sub">Official Java patch notes</span>
      </div>
      <div className="news-grid">
        {news.length === 0 ? (
          <p className="empty">News is unavailable right now — check your connection.</p>
        ) : (
          news.map((item) => (
            <article className="news-card news-card-large" key={item.id}>
              {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <div className="news-card-fallback" />}
              <div className="news-card-body">
                <span className={`badge badge-${item.category === "release" ? "release" : "snapshot"}`}>{item.category}</span>
                <h3>{item.title}</h3>
                <p>{item.shortText}</p>
                <time>{new Date(item.date).toLocaleDateString()}</time>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
