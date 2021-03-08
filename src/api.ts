import News from "./entity/News";

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
}
export const pattern = {
	number: /^[0-9]+$/,
	email: /^\w+@\w+\.+\w+$/,
	username: /^[a-z0-9\-_]+$/i
}