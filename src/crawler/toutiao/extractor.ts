import Cheerio = require("cheerio");
import { Article } from "./interface"
import News from "../../entity/News"

export default class TouTiaoExtractor {
	public static getNews(response: Article, html: string): News {
		const $ = Cheerio.load(html);
		const news = new News();
		news.id = response.item_id;
		news.title = response.title;
		news.author = response.source;
		if (response.image_url)
			news.image = "http" + response.image_url;
		news.date = new Date($(".article-meta>span").eq(1).text());
		news.article = $("article").html();
		return news;
	}
}