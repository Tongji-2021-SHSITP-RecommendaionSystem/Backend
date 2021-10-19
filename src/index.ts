import "basic-type-extensions";
import express = require("express");
import bodyParser = require("body-parser");
import cookieParser = require("cookie-parser");
import Mailer = require("nodemailer");
import FileSystem = require("fs");
import Mail = require("nodemailer/lib/mailer");
import { User, News, Session, BrowsingHistory } from "news-recommendation-entity";
import Database from "./database";
import { ModelTaskAllocator } from "news-recommendation-core";
import settings, { smtpConfig } from "./config";
import { TimeRecord } from "news-recommendation-entity/src/BrowsingHistory";
import { In } from "typeorm";
import { API, pattern } from "./api";
import { parse as parseHtml } from "node-html-parser";
import { ParamsDictionary } from "express-serve-static-core";
import { validateParameter, validatePayload } from "./validation";

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
	const app: express.Application = express();
	const port = 8081;
	app.enable("trust proxy");
	app.use(cookieParser(), bodyParser.json(), (_request, _response, next) =>
		next()
	);
	//API existence
	app.use("/api", (request, response: Response, next) => {
		if (!API.Accessibility.has("/api" + request.path))
			response.status(400).send("API not supported");
		else
			next();
	});
	//Session
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
				maxAge: settings.session.maxAge,
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
					API.Accessibility.authorized("/api" + request.path)
						? next()
						: response.status(401).send("Session doesn't exist");
				}
				else {
					response.locals.session = session;
					if (session.user) {
						session.lastAccessDate = new Date();
						database.sessions.update(session);
						response.cookie("sessionId", sessionId, {
							maxAge: settings.session.maxAge,
						});
					}
					next();
				}
			});
		}
	});
	//API authentification
	app.use("/api", (request, response: Response, next) => {
		const result = API.Accessibility.authorized(
			"/api" + request.path,
			response.locals.session.user
		);
		result === true ? next() : response.sendStatus(401);
	});

	app.get(
		"/api/user/hasUser",
		(
			request: Request<API.User.HasUser.Request>,
			response: Response<API.User.HasUser.Response>
		) => {
			if (
				!validateParameter(request, response, [
					"email",
					pattern.email,
					[1, 64],
				])
			)
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

	app.get(
		"/api/user/login",
		(request: Request<API.User.Login.Request>, response: Response) => {
			if (
				!validateParameter(
					request,
					response,
					["email", pattern.email, [1, 64]],
					["password", [1, 32]]
				)
			)
				return;
			database
				.findOneByConditions(User, { email: request.query.email })
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
					else if (user.password != request.query.password)
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

	const allocator = new ModelTaskAllocator();
	app.get(
		"/api/news/recommend",
		(
			request: Request<API.News.Recommend.Request>,
			response: Response<API.News.Recommend.Response>
		) => {
			if (
				!validateParameter(
					request,
					response,
					["count", pattern.number],
					["random", true, /^true|false$/]
				)
			)
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
						allocator
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
		"/api/news/getNews",
		(
			request: Request<API.News.GetNews.Request>,
			response: Response<API.News.GetNews.Response>
		) => {
			if (!validateParameter(request, response, ["id", pattern.number]))
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
		"/api/news/getNewsInfos",
		(
			request: Request<API.News.GetNewsInfos.Request>,
			response: Response<API.News.GetNewsInfos.Response>
		) => {
			if (!validateParameter(request, response, ["ids", Array])) return;
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

	const emailTemplate = parseHtml(
		FileSystem.readFileSync("email.html").toString()
	);
	app.post(
		"/api/user/sendEmail",
		async (
			request: Request<API.User.SendEmail.Request>,
			response: Response<{ timeLeft: number }>
		) => {
			if (
				!validateParameter(request, response, [
					"email",
					pattern.email,
					[1, 64],
				])
			)
				return;
			const metadata = response.locals.session.metadata
				? JSON.parse(response.locals.session.metadata)
				: {};
			if (
				metadata.mailTime &&
				Date.now() < metadata.mailTime + settings.session.emailInterval
			)
				response
					.status(429)
					.json({
						timeLeft:
							settings.session.emailInterval +
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
				const transporter = Mailer.createTransport(smtpConfig);
				const mailOptions: Mail.Options = {
					from: smtpConfig.auth.user,
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
		"/api/user/register",
		(
			request: Request<null, API.User.Register.Request>,
			response: Response<API.User.Register.Response>
		) => {
			if (
				!validatePayload(
					request,
					response,
					["username", String, pattern.username, [1, 32]],
					["password", String, [1, 32]],
					["email", String, pattern.email, [1, 64]],
					["code", String, /^[a-z0-9]{4}$/i]
				)
			)
				return;
			const metadata = response.locals.session.metadata
				? JSON.parse(response.locals.session.metadata)
				: {};
			if (
				metadata.mailTime &&
				Date.now() > metadata.mailTime + settings.session.emailInterval
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

	app.post(
		"/api/user/readNews",
		(request: Request<API.User.ReadNews.Request>, response: Response) => {
			if (
				!validateParameter(
					request,
					response,
					["id", pattern.number],
					["startTime", pattern.number],
					["endTime", pattern.number]
				)
			)
				return;
			const user = response.locals.session.user;
			const timeRecord: TimeRecord = {
				start: Number.parseInt(request.query.startTime),
				end: Number.parseInt(request.query.endTime),
			};
			const newsId = Number.parseInt(request.query.id);
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

	app.post("/api/user/logout", (request: Request, response: Response) => {
		response.clearCookie("sessionId");
		database.sessions.delete(response.locals.session!.id);
		response.sendStatus(200);
	});

	app.listen(port, () => console.log(`App listening on ${port}`));

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
