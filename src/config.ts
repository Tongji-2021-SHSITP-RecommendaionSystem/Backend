import FileSystem = require("fs");
import SMTPTransport = require("nodemailer/lib/smtp-transport");

export interface Settings {
	session: {
		maxAge: number;
	};
	model: {
		pythonPath: string;
		timerInterval: number;
		maxViewed: number;
		candidatesPerBatch: number;
	}
}
export type APIConfig = Map<string, [boolean]>

export function loadFile<T = string>(path: string): T {
	return JSON.parse(FileSystem.readFileSync(path).toString())
}
const settings = loadFile<Settings>("settings.json");
export const apiConfig: APIConfig = new Map<string, [boolean]>(loadFile<Array<[string, [boolean]]>>("apiconfig.json"));
export const smtpConfig = loadFile<SMTPTransport.Options>("smtpconfig.json");

export default settings;