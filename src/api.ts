import type { News, Reaction, User } from "news-recommendation-entity";

type RecordString<T extends string> = Record<T, string>;
export namespace API {
	export namespace User {
		export type Get = {
			response: User;
		}
		export type Post = {
			request: RecordString<"username" | "password" | "email" | "code">;
			response: Record<"id", number>;
		}
		export namespace Email {
			export type Get = {
				request: RecordString<"email">;
				response: Record<"exist", boolean>;
			}
		}
		export namespace Login {
			export type Post = {
				request: RecordString<"email" | "password">;
			}
		}
		export namespace Validation {
			export type Post = {
				request: RecordString<"email">;
			}
		}
		export namespace History {
			export type Post = {
				request: Record<"id" | "startTime" | "endTime", number>;
			}
		}
	}
	export namespace News {
		export type Get = {
			request: RecordString<"id">;
			response: InstanceType<typeof News>;
		}
		export namespace Infos {
			export type Get = {
				request: Record<"ids", string[]>;
				response: Record<"infos", News[]>;
			}
		}
		export namespace Analysis {
			export type Get = {
				request: RecordString<"id">;
				response: { keywords: string[], summary: string[], sentiment: number };
			}
		}
		export namespace Recommendation {
			export type Get = {
				request: { count: string; random?: string };
				response: Record<"ids", number[]>;
			}
		}

		export namespace Reaction {
			export type Get = {
				request: RecordString<"id">;
				response: Partial<Record<Reaction, number[]>>;
			}
			export type Put = {
				requestQuery: RecordString<"id">;
				requestBody: { reaction: Reaction };
			}
		}
	}
}
export const pattern = {
	number: /^[0-9]+$/,
	email: /^\w+@\w+\.+\w+$/,
	username: /^[a-z0-9\-_]+$/i,
};
