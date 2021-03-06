import Cheerio from "cheerio";
import { News } from "news-recommendation-entity";
import { ApiNewsInfo } from "./interface";

export default class WangYiExtractor {
	public static getNews(response: ApiNewsInfo, html: string): News | undefined {
		const $ = Cheerio.load(html);
		if ($("div.post_body").length == 0)
			return undefined;
		try {
			const news = new News();
			news.url = response.path;
			news.title = response.title;
			news.image = response.image;
			let infoText = $("div.post_info").text().trim();
			if (infoText.endsWith("举报"))
				infoText = infoText.substr(0, infoText.length - 2).trimRight();
			const infos = infoText.split(/来源[:：]/);
			news.date = new Date(infos[0].trimRight());
			news.source = infos[1].trimLeft();
			$("div.post_body>p").each((_, element) => {
				const html = $(element).html();
				$(element).html(html.trim());
			})
			news.article = $("div.post_body").html();
			return news;
		}
		catch (error) {
			return undefined;
		}
	}
}