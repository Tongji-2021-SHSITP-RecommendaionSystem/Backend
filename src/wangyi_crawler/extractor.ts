import Cheerio = require("cheerio")
import News from "../entity/News";
import { ApiNewsInfo } from "./interface";

export default class WangYiExtractor {
	public static getNews(response: ApiNewsInfo, html: string): News {
		const $ = Cheerio.load(html);
		const news = new News();
		news.url = response.path;
		news.title = response.title;
		news.image = response.image;
		const infos = $("div.post_info").clone().children().remove().end().text().trim().split("来源:");
		news.date = new Date(infos[0].trim());
		news.source = infos[1].trim();
		news.article = $("div.post_body").html();
		return news;
	}
}