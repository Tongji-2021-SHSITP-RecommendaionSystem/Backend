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
	public async fetch(page: number, count: number): Promise<ApiNewsInfo[]> {
		return new Promise((resolve, reject) =>
			Axios.post(
				"https://api.apiopen.top/getWangYiNews",
				{
					page: page.toString(),
					count: count.toString()
				}
			).then(
				(response: AxiosResponse<ApiResponse>) => resolve(response.data.result),
				error => reject(error)
			)
		);
	}
}