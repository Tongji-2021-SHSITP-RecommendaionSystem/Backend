type RecordString<T extends string> = Record<T, string>;
type Optionalize<T> = { [K in keyof T]?: T[K] };
export namespace Reqface {
	export namespace User {
		export type HasUser = RecordString<"email">
		export type Login = RecordString<"email" | "password">
		export type Register = RecordString<"username" | "password" | "email" | "verificationCode">
		export type SendEmail = RecordString<"email">
		export type ReadNews = RecordString<"id" | "startTime" | "endTime">
		export type Recommend = Optionalize<RecordString<"count">>
	}
	export namespace News {
		export type GetNews = RecordString<"id">
	}
}
export const pattern = {
	number: /^[0-9]+$/,
	email: /^\w+@\w+\.+\w+$/,
	username: /^[a-z0-9\-_]+$/i
}