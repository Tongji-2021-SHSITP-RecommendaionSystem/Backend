import "reflect-metadata";
import "basic-type-extensions";
import {
	Connection,
	createConnection,
	EntityTarget,
	FindConditions,
	Repository,
	SaveOptions,
} from "typeorm";
import { User, Session, BrowsingHistory } from "news-recommendation-entity";
import { session as SessionSettings } from "../settings.json"

class SessionManager {
	readonly length: number;
	readonly charset: string =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	protected readonly connection: Connection;
	constructor(connection: Connection, length: number = 16) {
		this.length = length;
		this.connection = connection;
	}
	protected randomId(): string {
		let result: string;
		do {
			result = "";
			for (let i = 0; i < this.length; ++i)
				result += this.charset.charAt(
					Math.floor(Math.random() * this.charset.length)
				);
		} while (result.length != this.length);
		return result;
	}
	async has(sessionId: string): Promise<boolean> {
		return (await this.get(sessionId)) != undefined;
	}
	async get(sessionId: string): Promise<Session> {
		const session = await this.connection.manager.findOne(
			Session,
			sessionId,
			{ relations: ["user"] }
		);
		if (!Object.isNullOrUndefined(session?.user)) {
			session.user.newsRecords = await this.connection
				.getRepository(BrowsingHistory)
				.find({
					where: {
						user: session.user,
					},
					relations: ["news"],
				});
			if (session.user.newsRecords)
				session.user.viewed = session.user.newsRecords.map(
					record => record.news
				);
		}
		return session;
	}
	add(maxAge?: number): Promise<Session>;
	add(user: User, maxAge?: number): Promise<Session>;
	async add(param1?: User | number, param2?: number): Promise<Session> {
		let session = new Session();
		session.maxAge =
			typeof param1 == "number"
				? param1
				: param2 != undefined
					? param2
					: SessionSettings.maxAge;
		const user = param1 instanceof User ? param1 : null;
		if (!user) {
			do {
				session.id = this.randomId();
			} while (await this.has(session.id));
		} else {
			if (user.session)
				return null;
			do {
				session.id = this.randomId();
			} while (await this.has(session.id));
			session.user = user;
		}
		session.lastAccessDate = new Date();
		return this.connection.manager.save(session);
	}
	async update(session: Session): Promise<boolean> {
		if (await this.has(session.id)) {
			this.connection.manager.save(session);
			return true;
		}
		else
			return false;
	}
	async delete(sessionId: string): Promise<boolean> {
		if (await this.has(sessionId)) {
			this.connection.manager.delete(Session, sessionId);
			return true;
		}
		else
			return false;
	}
}

export default class Database {
	protected connection: Connection;
	sessions: SessionManager;
	static async create() {
		let manager = new Database();
		manager.connection = await createConnection();
		manager.sessions = new SessionManager(manager.connection);
		return manager;
	}
	getTable<Entity>(target: EntityTarget<Entity>): Repository<Entity> {
		return this.connection.getRepository(target);
	}
	async has<Entity>(
		entity: EntityTarget<Entity>,
		id: number | string
	): Promise<boolean> {
		return this.connection
			.getRepository(entity)
			.findOne(id)
			.then(
				value => value != undefined && value != null,
				error => {
					console.log(error);
					return false;
				}
			);
	}
	save<Entity>(entities: Entity[], options?: SaveOptions): Promise<Entity[]>;
	save<Entity>(entity: Entity, options?: SaveOptions): Promise<Entity>;
	async save<Entity>(
		target: Entity | Entity[],
		options?: SaveOptions
	): Promise<Entity | Entity[]> {
		return this.connection.manager.save(target, options);
	}
	async findById<Entity>(
		entity: EntityTarget<Entity>,
		id: number | string,
		select?: (keyof Entity)[]
	): Promise<Entity> {
		return select
			? this.connection
				.getRepository(entity)
				.findOne(id, { select: select })
			: this.connection.getRepository(entity).findOne(id);
	}
	async findByConditions<Entity>(
		entity: EntityTarget<Entity>,
		conditions: FindConditions<Entity>,
		select?: (keyof Entity)[]
	): Promise<Entity[]> {
		return select
			? this.connection
				.getRepository(entity)
				.find({ where: conditions, select: select })
			: this.connection.getRepository(entity).find({ where: conditions });
	}
	async findOneByConditions<Entity>(
		entity: EntityTarget<Entity>,
		conditions: FindConditions<Entity>,
		select?: (keyof Entity)[]
	): Promise<Entity> {
		return select
			? this.connection
				.getRepository(entity)
				.findOne({ where: conditions, select: select })
			: this.connection
				.getRepository(entity)
				.findOne({ where: conditions });
	}
}
