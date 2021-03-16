import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, OneToOne, OneToMany } from "typeorm";
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

    @OneToOne(type => Session, session => session.user, {
        eager: true,
        persistence: false
    })
    readonly session?: Session;

    @OneToMany(type => BrowsingHistory, record => record.user, {
        cascade: true,
        eager: true
    })
    newsRecords: BrowsingHistory[];

    viewed: News[];

    constructor(id?: number) {
        if (id)
            this.id = id;
    }
}
