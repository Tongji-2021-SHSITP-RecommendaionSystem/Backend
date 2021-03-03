import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm"
import { User } from "./User";

@Entity()
export class News {
	@PrimaryGeneratedColumn()
	id: number;

	@Column("text")
	title: string;

	@Column("longtext")
	content: string;

	@Column({ type: "text", nullable: true })
	source: string;

	@ManyToMany(type => User, user => user.viewed)
	readers: User[];
}