import News from "./entity/News";
import User from "./entity/User";
import { apiConfig } from "./config"

type RecordString<T extends string> = Record<T, string>;
type Optionalize<T> = { [K in keyof T]?: T[K] };
export namespace API {
	export namespace User {
		export namespace HasUser {
			export type Request = RecordString<"email">
			export type Response = Record<"exist", boolean>
		}
		export namespace Login {
			export type Request = RecordString<"email" | "password">
		}
		export namespace Register {
			export type Request = RecordString<"username" | "password" | "email" | "code">
			export type Response = Record<"id", number>
		}
		export namespace SendEmail {
			export type Request = RecordString<"email">
		}
		export namespace ReadNews {
			export type Request = RecordString<"id" | "startTime" | "endTime">
		}
	}
	export namespace News {
		export namespace GetNews {
			export type Request = RecordString<"id">
			export type Response = InstanceType<typeof News>
		}
		export namespace GetNewsInfos {
			export type Request = Record<"ids", string[]>
			export type Response = Record<"infos", News[]>
		}
		export namespace Recommend {
			export type Request = { count: string; random?: string; }
			export type Response = Record<"ids", number[]>
		}
	}
	export class Accessibility {
		public static has(path: string) { return apiConfig.has(path); }
		public static authorized(path: string, user?: User): boolean {
			const target = apiConfig.get(path);
			return target[0] || user != undefined;
		};
	}
}
export const pattern = {
	number: /^[0-9]+$/,
	email: /^\w+@\w+\.+\w+$/,
	username: /^[a-z0-9\-_]+$/i
}