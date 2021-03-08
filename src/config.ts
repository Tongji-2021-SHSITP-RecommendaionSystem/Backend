import FileSystem = require("fs");
import { parse as parseHtml } from "node-html-parser";
import SMTPTransport = require("nodemailer/lib/smtp-transport");

export class EmailTemplate {
	config: SMTPTransport.Options = {
		host: "smtp.exmail.qq.com",
		port: 465,
		secure: true,
		auth: {
			user: "beyonews@truemogician.com",
			pass: "UwRoYc3Axrggf5kV"
		}
	}
	content: string
	constructor(target: string, code: string) {
		const html = parseHtml(FileSystem.readFileSync("email.html").toString());
		html.querySelector("#target").set_content(target);
		html.querySelector("#code").set_content(code);
		this.content = html.toString();
	}
}