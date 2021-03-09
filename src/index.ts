import "basic-type-extensions";
import express = require("express");
import cookieParser = require("cookie-parser");
import bodyParser = require("body-parser");
import nodemailer = require("nodemailer");
import FileSystem = require("fs");
import Mail = require("nodemailer/lib/mailer");
import SMTPTransport = require("nodemailer/lib/smtp-transport");
import Database from "./database";
import User from "./entity/User";
import Session from "./entity/Session";
import News from "./entity/News";
import { parse as parseHtml } from "node-html-parser";
import { validateParameter, validatePayload } from "./validation";
import { API, pattern } from "./api"


Database.create().then(database => {
	const app: express.Application = express();
	app.enable("trust proxy");
	app.use(cookieParser(), bodyParser.json(), (_request, _response, next) => next());
	const apis = new API.Accessibility();
	//API existence
	app.use("/api", (request, response, next) => {
		if (!apis.has("/api" + request.path)) response.status(400).send("API not supported");
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
		const result = apis.authorized("/api" + request.path, response.locals.session.user);
		if (result === true) next();
		else response.status(401).send(result);
	});

	app.get("/api/user/hasUser", (request, response) => {
		validateParameter(request, response, ["email", pattern.email, [1, 64]]);
		const query = request.query as object as API.User.HasUser.Request;
		database.findOneByConditions(User, { email: query.email as string }).then(
			user => {
				const result: API.User.HasUser.Response = {
					exist: user != null && user != undefined
				}
				response.json(result);
			},
			error => {
				console.log(error);
				response.sendStatus(500);
			}
		);
	});

	app.get("/api/user/login", (request, response) => {
		validateParameter(request, response,
			["email", pattern.email, [1, 64]],
			["password", [1, 32]]
		);
		const query = request.query as object as API.User.Login.Request;
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

	app.get("/api/user/recommend", (request, response) => {
		validateParameter(request, response, ["count", true, pattern.number]);
		const count = Number.parseInt((request.query as object as API.User.Recommend.Request).count ?? "6");
		const user = ((response.locals.session) as Session).user;
		if (!(user.viewed?.length >= 3)) {
		}
	});

	app.get("/api/news/getNews", (request, response) => {
		validateParameter(request, response, ["id", pattern.number]);
		const id = Number.parseInt((request.query as object as API.News.GetNews.Request).id);
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

	const smtpConfig = JSON.parse(FileSystem.readFileSync("smptconfig.json").toString()) as SMTPTransport.Options;
	const emailTemplate = parseHtml(FileSystem.readFileSync("email.html").toString());
	app.post("/api/user/sendEmail", async (request, response) => {
		validateParameter(request, response, ["email", pattern.email, [1, 64]]);
		const query = request.query as object as API.User.SendEmail.Request;
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
			let code: string;
			do {
				code = "";
				for (let i = 0; i < 4; ++i)
					code += charset.charAt(Math.floor(Math.random() * charset.length));
			} while (code.length != 4);
			emailTemplate.querySelector("#target").set_content(query.email);
			emailTemplate.querySelector("#code").set_content(code);
			const transporter = nodemailer.createTransport(smtpConfig);
			const mailOptions: Mail.Options = {
				from: smtpConfig.auth.user,
				to: query.email,
				subject: "闻所未闻验证邮件",
				html: emailTemplate.toString(),
			};
			transporter.sendMail(mailOptions, (error, info) => {
				if (error) {
					console.log(error);
					response.status(500).send("Email sending failed for unknown reason");
				}
				else {
					metadata.mailTime = Date.now();
					metadata.code = code;
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
			["code", String, /^[a-z0-9]{4}$/i]
		);
		const metadata = response.locals.session.metadata
			? JSON.parse(response.locals.session.metadata)
			: {};
		if (metadata.mailTime && Date.now() > metadata.mailTime + 600000) {
			delete metadata.code;
			delete metadata.mailTime;
			response.locals.session.metadata = JSON.stringify(metadata);
			database.sessions.update(response.locals.session);
			response.status(403).send("Verification code expired");
		}
		else if (response.locals.session.user)
			response.status(400).send("User already logged in");
		else if (!metadata.code)
			response.status(400).send("Verification email not sent");
		else if (metadata.code != request.body.code)
			response.status(403).send("Wrong verification code");
		else {
			const newUser = new User();
			const payload = request.body as object as API.User.Register.Request;
			newUser.username = payload.username;
			newUser.password = payload.password;
			newUser.email = payload.email;
			database
				.getTable(User)
				.save(newUser)
				.then((user) => {
					delete metadata.code;
					delete metadata.mailTime;
					response.locals.session.user = user;
					response.locals.session.metadata = JSON.stringify(metadata);
					database.sessions.update(response.locals.session);
					const result: API.User.Register.Response = {
						id: user.id
					}
					response.status(201).json(result);
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
		news.id = Number.parseInt((request.query as object as API.User.ReadNews.Request).id);
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