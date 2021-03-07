import Crawler = require("crawler");

export default class WangYiDownloader {
	public proxy?: string;
	protected downloader: Crawler;
	public constructor(options?: Crawler.CreateCrawlerOptions) {
		this.downloader = new Crawler(options ?? {
			maxConnections: 16,
			retries: 1,
			retryTimeout: 5000,
			userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.43"
		})
	}
	protected download(url: string, callback: (response: Crawler.CrawlerRequestResponse, done: () => void) => void, reject?: (reason?: any) => void) {
		this.downloader.queue({
			uri: url,
			proxy: this.proxy,
			callback: (err, res, completed) => {
				if (err) {
					console.log(err);
					if (reject)
						reject(err);
					completed();
				}
				else
					callback(res, completed);
			}
		})
	}
	public getPage(url: string): Promise<string> {
		return new Promise((resolve, reject) =>
			this.download(url, (response, done) => {
				resolve(response.body.toString());
				return done();
			}, reject)
		);
	}
}