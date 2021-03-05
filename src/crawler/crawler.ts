import Axios, { AxiosResponse } from "axios";
import * as TouTiao from "./interface";

export default class TouTiaoCrawler {
	protected static readonly api: string = "https://www.toutiao.com/api/pc/feed/";
	static userAgent: string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.43";
	behotTime: number;
	category: TouTiao.Catogory;
	constructor(category?: TouTiao.Catogory, behotTime?: number) {
		this.behotTime = behotTime ?? Math.floor(Date.now() / 1000);
		this.category = category ?? TouTiao.Catogory.All;
	}
	async crawl(category?: TouTiao.Catogory, behotTime?: number): Promise<TouTiao.Response> {
		return Axios.get(
			TouTiaoCrawler.api,
			{
				params: {
					max_behot_time: behotTime ?? this.behotTime,
					category: category ?? this.category
				},
				headers: {
					"User-Agent": TouTiaoCrawler.userAgent
				}
			}
		).then((response: AxiosResponse<TouTiao.Response>) => {
			this.behotTime = response.data.next.max_behot_time;
			return response.data;
		});
	}
}