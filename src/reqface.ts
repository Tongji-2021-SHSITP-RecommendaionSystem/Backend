export namespace Reqface {
	export namespace User {
		export interface HasUser {
			email: string;
		}
		export interface Login {
			email: string;
			password: string;
		}
		export interface Register {
			username: string;
			password: string;
			email: string;
			verificationCode: string;
		}
		export interface SendEmail {
			email: string;
		}
	}
}
export const pattern = {
	email: /^\w+@\w+\.+\w+$/,
	username: /^[a-z0-9\-_]+$/i
}