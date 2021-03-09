import "basic-type-extensions";
import WangYiFetcher from "./fetcher"
import WangYiDownloader from "./downloader"
import WangYiExtractor from "./extractor"
import News from "../entity/News";

export default class WangYiCrawler {
	protected fetcher: WangYiFetcher;
	protected downloader: WangYiDownloader;
	protected extractor: WangYiExtractor;
	constructor(proxy?: string) {
		this.fetcher = new WangYiFetcher();
		this.downloader = new WangYiDownloader();
		if (proxy) {
			this.fetcher.enableProxy(proxy);
			this.downloader.proxy = proxy;
		}
	}
	async crawl(count: number, offset: number = 0): Promise<News[]> {
		return new Promise((resolve, reject) =>
			this.fetcher.fetch(offset, count).then(
				async newsInfos => {
					const result = new Array<News>();
					await newsInfos.forEachAsync(async newsInfo =>
						await this.downloader.getPage(newsInfo.path).then(
							html => result.push(WangYiExtractor.getNews(newsInfo, html)),
							error => console.log(new Date(), error)
						) as void
					);
					resolve(result);
				},
				error => reject(error)
			)
		);
	}
}