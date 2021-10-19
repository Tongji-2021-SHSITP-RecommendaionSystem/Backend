import "basic-type-extensions";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import News from "./News";
import User from "./User";

export type TimeRecord = Record<"start" | "end", number>;

@Entity("browsing-history")
export default class BrowsingHistory {
	@ManyToOne(type => User, user => user.viewed, {
		primary: true,
		persistence: false,
	})
	@JoinColumn({ name: "userId" })
	user: User;

	@ManyToOne(type => News, news => news.readerRecords, {
		primary: true,
		persistence: false,
	})
	@JoinColumn({ name: "newsId" })
	news: News;

	@Column({ type: "text", name: "timeRecord" })
	_timeRecord: string;

	get timeRecord(): TimeRecord[] {
		return String.isNullOrEmpty(this._timeRecord)
			? []
			: JSON.parse(this._timeRecord);
	}
	set timeRecord(value: TimeRecord[]) {
		this._timeRecord = value?.length ? JSON.stringify(value) : String.empty;
	}

	constructor(userId?: number, newsId?: number, timeRecord?: TimeRecord[]) {
		if (userId) this.user = new User(userId);
		if (newsId) this.news = new News(newsId);
		if (timeRecord) this.timeRecord = timeRecord;
	}
}
