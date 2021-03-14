import Axios, { AxiosProxyConfig, AxiosResponse } from "axios";
import { URL } from "url";
import { ApiNewsInfo, ApiResponse } from "./interface";

export default class WangYiFetcher {
	protected static readonly origin: string = "https://www.toutiao.com";
	protected proxy: AxiosProxyConfig | false;
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
	public async fetch(count: number, offset: number = 0): Promise<ApiNewsInfo[]> {
		let page = 1 + Math.floor(offset / count);
		let num = Math.ceil((count + offset) / page);
		while (num * (page - 1) > offset)
			num = Math.ceil((count + offset) / --page);
		return new Promise((resolve, reject) =>
			Axios.post(
				"https://api.apiopen.top/getWangYiNews",
				null,
				{
					params: {
						page: page.toString(),
						count: num.toString()
					}
				}
			).then(
				(response: AxiosResponse<ApiResponse>) =>
					resolve(response.data.result.splice(offset - num * (page - 1), count)),
				error => reject(error)
			)
		);
	}
}