import "basic-type-extensions";
import TouTiaoFetcher from "./fetcher";
import TouTiaoDownloader from "./downloader";
import TouTiaoExtractor from "./extractor";
import Database from "../database";
import News from "../entity/News";
import { Article } from "./interface";

export default class TouTiaoCrawler {
	protected database: Database;
	protected fetcher: TouTiaoFetcher;
	protected downloader: TouTiaoDownloader;
	protected behotTime: number;
	public constructor(database: Database, proxy?: string) {
		this.database = database;
		this.fetcher = new TouTiaoFetcher();
		this.downloader = new TouTiaoDownloader();
		this.behotTime = 0;
		if (proxy) {
			this.downloader.proxy = proxy;
			this.fetcher.enableProxy(proxy);
		}
	}
	public resetBehotTime(timestamp?: number): void {
		this.behotTime = timestamp ?? Math.floor(Date.now() / 1000);
	}
	public async crawl(): Promise<News[]> {
		return new Promise(async (resolve, reject) => {
			this.fetcher.feed(this.behotTime).then(
				response => {
					this.behotTime = response.next.max_behot_time;
					const result = new Array<News>();
					const articles = response.data.filter(news => news.article_genre == "article");
					const returned = new Array<boolean>(articles.length);
					articles.forEachAsync(async (res: Article) => {
						if (!(await this.database.has(News, res.item_id))) {
							const url = "https://www.toutiao.com/a" + res.item_id;
							await this.downloader.getNewsPage(url).then(
								html => result.push(TouTiaoExtractor.getNews(res, html)),
								error => console.log(url, error)
							);
						}
					}).then(() => resolve(result));
				},
				error => reject(error)
			);
		});
	}
}