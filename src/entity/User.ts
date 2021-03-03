import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, OneToOne } from "typeorm";
import { News } from "./News";
import { Session } from "./Session";

@Entity()
export class User {
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

    @ManyToMany(type => News, news => news.readers, {
        eager: true,
        persistence: false,
    })
    @JoinTable({ name: "user-view-news" })
    viewed?: News[];
}
