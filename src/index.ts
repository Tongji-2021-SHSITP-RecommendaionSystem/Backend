import "basic-type-extensions";
import express = require("express");
import cookieParser = require("cookie-parser");
import bodyParser = require("body-parser");
import nodemailer = require("nodemailer");
import FileSystem = require("fs");
import Mail = require("nodemailer/lib/mailer");
import Database from "./database";
import { validateParameter, validatePayload } from "./validation";
import User from "./entity/User";
import Session from "./entity/Session";
import { Reqface, pattern } from "./reqface"
import { EmailTemplate } from "./config";
import News from "./entity/News";

type APIRestraintTuple = [boolean];
class API {
	private restrictions: Map<string, APIRestraintTuple>;
	constructor(configFile?: string) {
		FileSystem.readFile(configFile ?? "api.json", "utf8", (error, data) => {
			if (error) throw error;
			else {
				const json = JSON.parse(data);
				this.restrictions = new Map(Object.entries(json) as [string, APIRestraintTuple][]);
			}
		});
	}
	has = (path: string) => this.restrictions.has(path);
	authorized = (path: string, user: User): true | string => {
		const target = this.restrictions.get(path);
		return (target[0] || user) ? true : "Login required";
	};
}
const APIs = new API();

Database.create().then(database => {
	const app: express.Application = express();
	app.enable("trust proxy");
	app.use(cookieParser(), bodyParser.json(), (_request, _response, next) => next());
	//API existence
	app.use("/api", (request, response, next) => {
		if (!APIs.has("/api" + request.path)) response.status(400).send("API not supported");
		else next();
	});
	//Session
	app.use("/api", async (request, response, next) => {
		console.log({
			time: new Date(),
			url: request.url,
			path: request.path,
			params: request.query,
			payload: request.body,
			cookies: request.cookies,
		});
		async function createSession(): Promise<Session> {
			const session = await database.sessions.add();
			response.locals.session = session;
			response.cookie("sessionId", session.id);
			return session;
		}
		if (!request.cookies?.sessionId) createSession().then((_) => next());
		else {
			const sessionId = request.cookies.sessionId;
			if (!(await database.sessions.has(sessionId))) {
				await createSession();
				request.path == "/user/login"
					? next()
					: response.status(401).send("sessionId doesn't exist");
			} else {
				database.sessions.get(sessionId).then(async (session) => {
					if (session.expired()) {
						database.sessions.delete(sessionId);
						const newSession = await createSession();
						if (session.user && request.path != "/user/login")
							response.status(401).send("Session expired");
						else next();
					} else {
						session.lastAccessDate = new Date();
						database.sessions.update(session);
						response.locals.session = session;
						next();
					}
				});
			}
		}
	});
	//API authentification
	app.use("/api", (request, response, next) => {
		const result = APIs.authorized("/api" + request.path, response.locals.session.user);
		if (result === true) next();
		else response.status(401).send(result);
	});

	app.get("/api/user/hasUser", (request, response) => {
		validateParameter(request, response, ["email", pattern.email, [1, 64]]);
		const query = request.query as object as Reqface.User.HasUser;
		database.findOneByConditions(User, { email: query.email as string }).then(user => {
			response.json({
				exist: user != null && user != undefined,
			});
		});
	});

	app.get("/api/user/login", (request, response) => {
		validateParameter(request, response,
			["email", pattern.email, [1, 64]],
			["password", [1, 32]]
		);
		const query = request.query as object as Reqface.User.Login;
		database
			.findOneByConditions(User, { email: query.email as string })
			.then(async user => {
				if (!user)
					response.status(401).send("Email not registered");
				else if (user.session)
					response.status(400).send("User already logged in");
				else if (user.password != query.password)
					response.status(401).send("Wrong password");
				else {
					response.locals.session.user = user;
					database.sessions.update(response.locals.session).then(success => {
						success
							? response.status(200).send("Logged in successfully")
							: response.sendStatus(500);
					});
				}
			});
	});

	app.get("/api/news/getNews", (request, response) => {
		validateParameter(request, response, ["id", /^[0-9]+$/]);
		const id = Number.parseInt((request.query as object as Reqface.News.GetNews).id);
		database.findById(News, id).then(
			news => {
				if (news != null && news != undefined)
					response.status(200).json(news);
				else
					response.status(404).send("News not found")
			},
			error => response.sendStatus(500)
		);
	})

	app.post("/api/user/sendEmail", async (request, response) => {
		validateParameter(request, response, ["email", pattern.email, [1, 64]]);
		const query = request.query as object as Reqface.User.SendEmail;
		let metadata = response.locals.session.metadata;
		metadata = metadata ? JSON.parse(metadata) : {};
		if (metadata.mailTime && Date.now() < metadata.mailTime + 60000)
			response.status(429).json({
				timeLeft: 60000 + metadata.mailTime - Date.now(),
			});
		else {
			if (await database.findOneByConditions(User, { email: query.email }))
				return response.status(403).send("Email address already registered");
			const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
			let verificationCode: string;
			do {
				verificationCode = "";
				for (let i = 0; i < 4; ++i)
					verificationCode += charset.charAt(Math.floor(Math.random() * charset.length));
			} while (verificationCode.length != 4);
			const mail = new EmailTemplate(query.email as string, verificationCode);
			const transporter = nodemailer.createTransport(mail.config);
			const mailOptions: Mail.Options = {
				from: mail.config.auth.user,
				to: query.email,
				subject: "昨日头条验证邮件",
				html: mail.content,
			};
			transporter.sendMail(mailOptions, (error, info) => {
				if (error) {
					console.log(error);
					response.status(500).send("Email sending failed for unknown reason");
				}
				else {
					metadata.mailTime = Date.now();
					metadata.verificationCode = verificationCode;
					response.locals.session.metadata = JSON.stringify(metadata);
					database.sessions.update(response.locals.session);
					console.log("Email sent: " + info.response);
					response.sendStatus(200);
				}
			});
		}
	});

	app.post("/api/user/register", (request, response) => {
		validatePayload(request, response,
			["username", String, pattern.username, [1, 32]],
			["password", String, [1, 32]],
			["email", String, pattern.email, [1, 64]],
			["verificationCode", String, /^[a-z0-9]{4}$/i]
		);
		const metadata = response.locals.session.metadata
			? JSON.parse(response.locals.session.metadata)
			: {};
		if (metadata.mailTime && Date.now() > metadata.mailTime + 600000) {
			delete metadata.verificationCode;
			delete metadata.mailTime;
			response.locals.session.metadata = JSON.stringify(metadata);
			database.sessions.update(response.locals.session);
			response.status(403).send("Verification code expired");
		}
		else if (response.locals.session.user)
			response.status(400).send("User already logged in");
		else if (!metadata.verificationCode)
			response.status(400).send("Verification email not sent");
		else if (metadata.verificationCode != request.body.verificationCode)
			response.status(403).send("Wrong verification code");
		else {
			const newUser = new User();
			const payload = request.body as object as Reqface.User.Register;
			newUser.username = payload.username;
			newUser.password = payload.password;
			newUser.email = payload.email;
			database
				.getTable(User)
				.save(newUser)
				.then((user) => {
					delete metadata.verificationCode;
					delete metadata.mailTime;
					response.locals.session.user = user;
					response.locals.session.metadata = JSON.stringify(metadata);
					database.sessions.update(response.locals.session);
					response.status(201).json({
						id: user.id,
					});
				});
		}
	});

	app.post("/api/user/readNews", (request, response) => {
		validateParameter(request, response,
			["id", pattern.number],
			["startTime", pattern.number],
			["endTime", pattern.number]
		);
		const user = ((response.locals.session) as Session).user;
		const news = new News();
		news.id = Number.parseInt((request.query as object as Reqface.User.ReadNews).id);
		if (!user.viewed?.length)
			user.viewed = new Array<News>();
		user.viewed.push(news);
		database.save(user).then(
			_ => response.sendStatus(200),
			_ => response.sendStatus(500)
		)
	});

	app.listen(8081, () => console.log("App listening on 8081"));

	const sessionCleaner = setInterval(() => {
		database
			.getTable(Session)
			.find()
			.then((sessions) => {
				let count = 0;
				for (const session of sessions) {
					if (session.expired()) {
						database.sessions.delete(session.id);
						++count;
					}
				}
				if (count)
					console.log(`${count} / ${sessions.length} session(s) have been cleared`);
			});
	}, 120000);
});