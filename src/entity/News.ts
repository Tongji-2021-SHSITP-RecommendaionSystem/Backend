import Cheerio = require("cheerio");
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import BrowsingHistory from "./BrowsingHistory";
import User from "./User";

@Entity()
export default class News {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	url: string;

	@Column("text")
	title: string;

	@Column("longtext")
	article: string;

	@Column("text")
	source: string;

	@Column()
	date: Date;

	@Column({ type: "text", nullable: true })
	image?: string;

	@OneToMany(type => BrowsingHistory, record => record.news, {
		persistence: false,
	})
	readerRecords: BrowsingHistory[];

	readers: User[];

	get content(): string {
		return Cheerio.load(this.article)("*").text();
	}

	constructor(id?: number) {
		if (id) this.id = id;
	}
}
