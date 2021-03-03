import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn } from "typeorm"
import { User } from "./User";

@Entity()
export class Session {
    @PrimaryColumn("char", { length: 16 })
    id: string

    @OneToOne(type => User, user => user.session, {
        persistence: false,
    })
    @JoinColumn()
    user?: User

    @CreateDateColumn()
    creationDate: Date

    @Column()
    lastAccessDate: Date

    @Column()
    maxAge: number

    @Column({ type: "text", nullable: true })
    metadata?: string

    expired(): boolean;
    expired(time: Date): boolean;
    expired(time?: Date): boolean {
        let date = time ? time.getTime() : Date.now();
        return date > this.lastAccessDate.getTime() + this.maxAge;
    }
}