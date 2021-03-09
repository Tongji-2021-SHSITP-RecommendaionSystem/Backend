import FileSystem = require("fs");
import News from "./entity/News";
import User from "./entity/User";

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
		export namespace Recommend {
			export type Request = Optionalize<RecordString<"count">>
		}
	}
	export namespace News {
		export namespace GetNews {
			export type Request = RecordString<"id">;
			export type Response = InstanceType<typeof News>
		}
	}
	type APIRestraintTuple = [boolean];
	export class Accessibility {
		protected restrictions: Map<string, APIRestraintTuple>;
		constructor(configFile?: string) {
			FileSystem.readFile(configFile ?? "api.json", "utf8", (error, data) => {
				if (error) throw error;
				else {
					const json = JSON.parse(data);
					this.restrictions = new Map(Object.entries(json) as [string, APIRestraintTuple][]);
				}
			});
		}
		has(path: string) { return this.restrictions.has(path); }
		authorized(path: string, user: User): boolean {
			const target = this.restrictions.get(path);
			return target[0] || user != undefined;
		};
	}
}
export const pattern = {
	number: /^[0-9]+$/,
	email: /^\w+@\w+\.+\w+$/,
	username: /^[a-z0-9\-_]+$/i
}