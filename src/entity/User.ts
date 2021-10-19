import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	OneToOne,
	OneToMany,
	CreateDateColumn,
} from "typeorm";
import BrowsingHistory from "./BrowsingHistory";
import News from "./News";
import Session from "./Session";

@Entity()
export default class User {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ length: 32 })
	username: string;

	@Column({ length: 32 })
	password: string;

	@Column({ length: 64, unique: true })
	email: string;

	@CreateDateColumn()
	joinDate: Date;

	@OneToOne(type => Session, session => session.user, {
		eager: true,
		persistence: false,
	})
	readonly session?: Session;

	@OneToMany(type => BrowsingHistory, record => record.user, {
		cascade: true,
	})
	newsRecords: BrowsingHistory[];

	viewed: News[];

	constructor(id?: number) {
		if (id) this.id = id;
	}
}
