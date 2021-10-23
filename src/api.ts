import { News, User } from "news-recommendation-entity";
const ApiConfig = new Map<string, [boolean]>(require("../settings.json").api);

type RecordString<T extends string> = Record<T, string>;
export namespace API {
	export namespace User {
		export namespace HasUser {
			export type Request = RecordString<"email">;
			export type Response = Record<"exist", boolean>;
		}
		export namespace Login {
			export type Request = RecordString<"email" | "password">;
		}
		export namespace Register {
			export type Request = RecordString<
				"username" | "password" | "email" | "code"
			>;
			export type Response = Record<"id", number>;
		}
		export namespace SendEmail {
			export type Request = RecordString<"email">;
		}
		export namespace ReadNews {
			export type Request = RecordString<"id" | "startTime" | "endTime">;
		}
	}
	export namespace News {
		export namespace GetNews {
			export type Request = RecordString<"id">;
			export type Response = InstanceType<typeof News>;
		}
		export namespace GetNewsInfos {
			export type Request = Record<"ids", string[]>;
			export type Response = Record<"infos", News[]>;
		}
		export namespace GetNewsMeta {
			export type Request = RecordString<"id">;
			export type Response = { keywords: string[], summary: string[], sentiment: number };
		}
		export namespace Recommend {
			export type Request = { count: string; random?: string };
			export type Response = Record<"ids", number[]>;
		}
	}
	export class Accessibility {
		public static has(path: string) {
			return ApiConfig.has(path);
		}
		public static authorized(path: string, user?: User): boolean {
			const target = ApiConfig.get(path);
			return target[0] || user != undefined;
		}
	}
}
export const pattern = {
	number: /^[0-9]+$/,
	email: /^\w+@\w+\.+\w+$/,
	username: /^[a-z0-9\-_]+$/i,
};
