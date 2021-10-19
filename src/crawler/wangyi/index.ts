import "basic-type-extensions";
import ProgressBar from "cli-progress";
import { News } from "news-recommendation-entity";
import WangYiFetcher from "./fetcher";
import WangYiDownloader from "./downloader";
import WangYiExtractor from "./extractor";
import { ApiNewsInfo } from "./interface";

export default class WangYiCrawler {
	public reportProgress: boolean = true;
	protected fetcher: WangYiFetcher;
	protected downloader: WangYiDownloader;
	protected extractor: WangYiExtractor;
	private progressBar: ProgressBar.SingleBar;
	constructor(proxy?: string) {
		this.fetcher = new WangYiFetcher();
		this.downloader = new WangYiDownloader();
		if (proxy) {
			this.fetcher.enableProxy(proxy);
			this.downloader.proxy = proxy;
		}
		this.progressBar = new ProgressBar.SingleBar({
			hideCursor: true,
			stopOnComplete: true,
			barsize: 50
		}, ProgressBar.Presets.shades_classic)
	}
	async crawl(count: number, offset: number = 0): Promise<News[]> {
		return new Promise((resolve, reject) =>
			this.fetcher.fetch(count, offset).then(
				async newsInfos => {
					if (this.reportProgress)
						this.progressBar.start(count, 0);
					const result = new Array<News>();
					const errorCausingNews = new Array<ApiNewsInfo>();
					await newsInfos.forEachAsync(async newsInfo =>
						await this.downloader.getPage(newsInfo.path).then(
							html => {
								const news = WangYiExtractor.getNews(newsInfo, html);
								if (news != null && news != undefined)
									result.push(news);
								else
									errorCausingNews.push(newsInfo);
								if (this.reportProgress)
									this.progressBar.increment();
							},
							error => {
								errorCausingNews.push(newsInfo);
								if (this.reportProgress)
									this.progressBar.increment();
							}
						) as void
					);
					if (this.reportProgress)
						this.progressBar.stop();
					console.log(errorCausingNews.map(news => news.path));
					resolve(result);
				},
				error => reject(error)
			)
		);
	}
}