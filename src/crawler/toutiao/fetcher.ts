import { URL } from "url";
import Puppeteer = require("puppeteer")
import Axios, { AxiosProxyConfig, AxiosResponse } from "axios";
import * as TouTiao from "./interface";

export default class TouTiaoFetcher {
	//public static userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.43";
	protected static readonly origin: string = "https://www.toutiao.com";
	protected static readonly api: string = TouTiaoFetcher.origin + "/api/pc/feed/";

	public category: TouTiao.Catogory;
	protected proxy: AxiosProxyConfig | false;
	protected browser: Puppeteer.Browser;
	protected page: Puppeteer.Page;
	protected cookie: {
		name: string;
		value: string;
	};
	private ready: boolean;

	public constructor(category?: TouTiao.Catogory) {
		this.category = category ?? TouTiao.Catogory.All;
		this.proxy = false;
		this.ready = false;
		Puppeteer.launch().then(async browser => {
			this.browser = browser;
			this.page = await this.browser.newPage();
			await this.page.goto(TouTiaoFetcher.origin);
			this.cookie = {
				name: "tt_webid",
				value: (await this.page.cookies()).find(cookie => cookie.name == "tt_webid").value
			}
			this.ready = true;
		});
	}
	public enableProxy(proxy?: string) {
		const url = new URL(proxy ?? "http://127.0.0.1:7890");
		this.proxy = {
			host: url.hostname,
			port: Number.parseInt(url.port),
			protocol: url.protocol
		}
	}
	public disableProxy() {
		this.proxy = false;
	}
	public async feed(behotTime: number, category?: TouTiao.Catogory): Promise<TouTiao.Response> {
		category = category ?? this.category;
		if (!this.ready) {
			await new Promise<void>(resolve => {
				const timer = setInterval(() => {
					if (this.ready) {
						clearInterval(timer);
						resolve();
					}
				}, 200);
			});
		}
		return new Promise(async (resolve, reject) => {
			Axios.get(
				TouTiaoFetcher.api, {
				proxy: this.proxy,
				params: {
					...(behotTime == 0 ? { min_behot_time: 0 } : { max_behot_time: behotTime }),
					...{
						category: category,
						utm_source: "toutiao",
						widen: 1,
						tadrequire: true,
						_signature: await this.sign(behotTime, category)
					}
				},
				headers: {
					"Cookie": `${this.cookie.name}=${this.cookie.value}`,
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36 Edg/89.0.774.45"
				}
			}).then(
				(response: AxiosResponse<TouTiao.Response>) => {
					console.log(response.headers);
					resolve(response.data);
				},
				error => reject(error)
			);
		});
	}
	protected async sign(behotTime: number, category: TouTiao.Catogory = TouTiao.Catogory.All): Promise<string> {
		const url = `https://www.toutiao.com/toutiao/api/pc/feed/?${behotTime == 0 ? "min" :
			"max"}_behot_time=${behotTime}&category=${category}&utm_source=toutiao&widen=1&tadrequire=true`;
		let window: any;
		return this.page.evaluate(url => window.byted_acrawler.sign({ url: url }), url);
	}
}