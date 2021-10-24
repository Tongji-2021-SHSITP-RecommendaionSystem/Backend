import "basic-type-extensions";
import FileSystem from "fs";
import express from "express";
import cookieParser from "cookie-parser";
import Mailer from "nodemailer";
import { In } from "typeorm";
import { parse as parseHtml } from "node-html-parser";
import { ParamsDictionary } from "express-serve-static-core";
import { Runner } from "news-recommendation-core";
import { User, News, Session, BrowsingHistory } from "news-recommendation-entity";
import { TimeRecord } from "news-recommendation-entity/src/BrowsingHistory";
import Database from "./database";
import { API, pattern } from "./api";
import { validateParameter, validatePayload } from "./validation";
import Settings from "../settings.json"

import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const SmtpConfig: SMTPTransport.Options = require("../settings.json").smtp;

interface ResponseLocal {
	session?: Session;
}
type Request<ReqQuery = any, ReqBody = any> = express.Request<
	ParamsDictionary,
	any,
	ReqBody,
	ReqQuery
>;
type Response<ResBody = string> = express.Response<
	ResBody | string,
	ResponseLocal
>;
function handleInternalError<
	T,
	Res extends express.Response = express.Response
>(response: Res, status: number = 500, message?: string) {
	return (error: T) => {
		console.log(error);
		if (message)
			response.status(status).end(message);
		else
			response.sendStatus(status);
	};
}
Database.create().then(database => {
	const app = express();
	const runner = new Runner();
	const emailTemplate = parseHtml(FileSystem.readFileSync("email.html").toString());
	app.enable("trust proxy");
	//#region Global Middlewares
	app.use(express.json() as any, cookieParser());
	// Handle Session
	app.use("/api", async (request, response: Response, next) => {
		console.log({
			time: new Date().toLocaleTimeString(),
			url: request.url,
			path: request.path,
			params: request.query,
			payload: request.body,
			cookies: request.cookies,
		});
		async function createSession(): Promise<Session> {
			const session = await database.sessions.add();
			response.locals.session = session;
			response.cookie("sessionId", session.id, {
				maxAge: Settings.session.maxAge,
			});
			return session;
		}
		if (!request.cookies?.sessionId)
			createSession().then(_ => next());
		else {
			const sessionId = request.cookies.sessionId;
			database.sessions.get(sessionId).then(async session => {
				if (session?.expired()) {
					database.sessions.delete(sessionId);
					session = undefined;
				}
				if (!session) {
					await createSession();
					next();
				}
				else {
					response.locals.session = session;
					if (session.user) {
						session.lastAccessDate = new Date();
						database.sessions.update(session);
						response.cookie("sessionId", sessionId, {
							maxAge: Settings.session.maxAge,
						});
					}
					next();
				}
			});
		}
	});
	//#endregion

	//#region User
	app.post(
		"/api/user",
		(
			request: Request<null, API.User.Post["request"]>,
			response: Response<API.User.Post["response"]>
		) => {
			if (validatePayload(
				request,
				response,
				["username", String, pattern.username, [1, 32]],
				["password", String, [1, 32]],
				["email", String, pattern.email, [1, 64]],
				["code", String, /^[a-z0-9]{4}$/i]
			) !== true)
				return;
			const metadata = response.locals.session.metadata
				? JSON.parse(response.locals.session.metadata)
				: {};
			if (
				metadata.mailTime &&
				Date.now() > metadata.mailTime + Settings.session.emailInterval
			) {
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
				newUser.email = request.body.email;
				newUser.username = request.body.username;
				newUser.password = request.body.password;
				database
					.getTable(User)
					.save(newUser)
					.then(user => {
						delete metadata.code;
						delete metadata.mailTime;
						response.locals.session.user = user;
						response.locals.session.metadata =
							JSON.stringify(metadata);
						database.sessions.update(response.locals.session);
						response.status(201).json({ id: user.id });
					});
			}
		}
	);

	app.get(
		"/api/user/email",
		(
			request: Request<API.User.Email.Get["request"]>,
			response: Response<API.User.Email.Get["response"]>
		) => {
			if (validateParameter(request, response, [
				"email",
				pattern.email,
				[1, 64],
			]) !== true)
				return;
			database
				.findOneByConditions(User, { email: request.query.email })
				.then(
					user =>
						response.json({
							exist: user != null && user != undefined,
						}),
					handleInternalError(response)
				);
		}
	);

	app.post(
		"/api/user/login",
		(request: Request<null, API.User.Login.Post["request"]>, response: Response) => {
			if (validatePayload(
				request,
				response,
				["email", pattern.email, [1, 64]],
				["password", [1, 32]]
			) !== true)
				return;
			database
				.findOneByConditions(User, { email: request.body.email })
				.then(async user => {
					if (!user)
						response.status(401).send("Email not registered");
					else if (user.session) {
						response.cookie("sessionId", user.session.id, {
							maxAge:
								user.session.maxAge +
								+user.session.lastAccessDate -
								Date.now(),
						});
						response.status(200).send("User already logged in");
					}
					else if (user.password != request.body.password)
						response.status(401).send("Wrong password");
					else {
						response.locals.session.user = user;
						database.sessions
							.update(response.locals.session)
							.then(
								success =>
									response.sendStatus(success ? 200 : 500),
								handleInternalError(response)
							);
					}
				});
		}
	);

	app.delete("/api/user/login", (_: Request, response: Response) => {
		if (!response.locals.session?.user) {
			response.status(401).end();
			return;
		}
		response.clearCookie("sessionId");
		database.sessions.delete(response.locals.session!.id);
		response.sendStatus(200);
	});

	app.post(
		"/api/user/validation",
		async (
			request: Request<API.User.Validation.Post["request"]>,
			response: Response<{ timeLeft: number }>
		) => {
			if (validateParameter(request, response, [
				"email",
				pattern.email,
				[1, 64],
			]) !== true)
				return;
			const metadata = response.locals.session.metadata
				? JSON.parse(response.locals.session.metadata)
				: {};
			if (
				metadata.mailTime &&
				Date.now() < metadata.mailTime + Settings.session.emailInterval
			)
				response
					.status(429)
					.json({
						timeLeft:
							Settings.session.emailInterval +
							metadata.mailTime -
							Date.now(),
					});
			else {
				if (await database.findOneByConditions(User, { email: request.query.email, }))
					return response.status(403).send("Email address already registered");
				const charset =
					"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
				let code: string;
				do {
					code = "";
					for (let i = 0; i < 4; ++i)
						code += charset.charAt(
							Math.floor(Math.random() * charset.length)
						);
				} while (code.length != 4);
				emailTemplate.querySelector("#code").set_content(code);
				const transporter = Mailer.createTransport(SmtpConfig);
				const mailOptions: Mail.Options = {
					from: SmtpConfig.auth.user,
					to: request.query.email,
					subject: "闻所未闻验证邮件",
					html: emailTemplate.toString(),
				};
				transporter.sendMail(mailOptions, (error, info) => {
					if (error) {
						console.log(error);
						response
							.status(500)
							.send("Email sending failed for unknown reason");
					}
					else {
						metadata.mailTime = Date.now();
						metadata.code = code;
						response.locals.session.metadata =
							JSON.stringify(metadata);
						database.sessions.update(response.locals.session);
						console.log("Email sent: " + info.response);
						response.sendStatus(200);
					}
				});
			}
		}
	);

	app.post(
		"/api/user/history",
		(request: Request<null, API.User.History.Post["request"]>, response: Response) => {
			if (validatePayload(
				request,
				response,
				["id", Number],
				["startTime", Number],
				["endTime", Number]
			) !== true)
				return;
			const user = response.locals.session.user;
			if (!user) {
				response.sendStatus(401);
				return;
			}
			const timeRecord: TimeRecord = {
				start: request.body.startTime,
				end: request.body.endTime,
			};
			const newsId = request.body.id;
			let record = user.newsRecords?.find(
				record => record.news.id == newsId
			);
			if (record) {
				const records = record.timeRecord;
				records.push(timeRecord);
				record.timeRecord = records;
			}
			else {
				record = new BrowsingHistory(user.id, newsId, [timeRecord]);
				if (Object.isNullOrUndefined(user.newsRecords))
					user.newsRecords = new Array();
				user.newsRecords.push(record);
			}
			database.save(user).then(
				_ => response.sendStatus(200),
				_ => response.sendStatus(500)
			);
		}
	);
	//#endregion

	//#region News
	app.use("/api/news", (_: Request, response: Response, next) => {
		if (!response.locals.session?.user)
			response.sendStatus(401);
		else
			next();
	});

	app.get(
		"/api/news",
		(
			request: Request<API.News.Get["request"]>,
			response: Response<API.News.Get["response"]>
		) => {
			if (validateParameter(request, response, ["id", pattern.number]) !== true)
				return;
			const id = Number.parseInt(request.query.id);
			database.findById(News, id).then(news => {
				if (news != null && news != undefined)
					response.status(200).json(news);
				else
					response.status(404).send("News not found");
			}, handleInternalError(response));
		}
	);

	app.get(
		"/api/news/recommendation",
		(
			request: Request<API.News.Recommendation.Get["request"]>,
			response: Response<API.News.Recommendation.Get["response"]>
		) => {
			if (validateParameter(
				request,
				response,
				["count", pattern.number],
				["random", true, /^true|false$/]
			) !== true)
				return;
			const count = Number.parseInt(request.query.count);
			const random = request.query.random === "true";
			const user = response.locals.session.user;
			if (!user.viewed?.length || random) {
				database
					.getTable(News)
					.createQueryBuilder("news")
					.select("news.id")
					.take(count)
					.orderBy("RAND()")
					.getMany()
					.then(
						newses =>
							response.json({ ids: newses.map(news => news.id) }),
						handleInternalError(response)
					);
			}
			else {
				database
					.getTable(News)
					.createQueryBuilder("news")
					.where(
						`news.id NOT IN (${user.viewed
							.map(news => news.id)
							.toString()})`
					)
					.orderBy("RAND()")
					.take(count * 5)
					.getMany()
					.then(newses => {
						const start = Date.now();
						runner
							.recommend(user.viewed, newses)
							.then(result => {
								console.log(
									`Recommendation time cost: `,
									Date.now() - start,
									" ms"
								);
								response.send({
									ids: result
										.slice(0, count)
										.map(value => value[0].id),
								});
							}, handleInternalError(response));
					}, handleInternalError(response));
			}
		}
	);

	app.get(
		"/api/news/analysis",
		(
			request: Request<API.News.Analysis.Get["request"]>,
			response: Response<API.News.Analysis.Get["response"]>
		) => {
			if (validateParameter(
				request,
				response,
				["id", pattern.number]
			) !== true)
				return;
			const id = Number.parseInt(request.query.id);
			database.findById(News, id).then(
				async news => {
					if (news != null && news != undefined) {
						const content = news.content;
						response.status(200).json({
							keywords: await runner.keywords(content, 5),
							summary: await runner.summary(content, 3),
							sentiment: await runner.sentiment(content)
						});
					}
					else
						response.status(404).send("News not found");
				},
				handleInternalError(response)
			)
		}
	)

	app.get(
		"/api/news/infos",
		(
			request: Request<API.News.Infos.Get["request"]>,
			response: Response<API.News.Infos.Get["response"]>
		) => {
			if (validateParameter(request, response, ["ids", Array]) !== true)
				return;
			const ids = request.query.ids.map(id => Number.parseInt(id));
			database
				.getTable(News)
				.find({
					where: { id: In(ids) },
					select: ["id", "title", "url", "image", "date", "source"],
				})
				.then(
					newses => response.json({ infos: newses }),
					handleInternalError(response)
				);
		}
	);
	//#endregion

	app.use((_, response: Response) => {
		if (!response.writableEnded)
			response.sendStatus(404);
	})

	app.listen(Settings.port, () => console.log(`App listening on ${Settings.port}`));

	const sessionCleaner = setInterval(() => {
		database
			.getTable(Session)
			.find()
			.then(sessions => {
				let count = 0;
				for (const session of sessions) {
					if (session.expired()) {
						database.sessions.delete(session.id);
						++count;
					}
				}
				if (count)
					console.log(
						`${count} / ${sessions.length} session(s) have been cleared`
					);
			});
	}, 120000);
});
