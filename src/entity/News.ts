import Cheerio = require("cheerio");
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm"
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

	@ManyToMany(type => User, user => user.viewed, {
		persistence: false
	})
	readers?: User[];

	get content(): string {
		return Cheerio.load(this.article)("*").text();
	}
}