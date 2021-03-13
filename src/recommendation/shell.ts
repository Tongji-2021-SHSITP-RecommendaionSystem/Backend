import FileSystem = require("fs");
import { PythonShell } from "python-shell"
import News from "../entity/News"

interface SimpleNews {
	title: string;
	content: string;
}
export default class Recommender {
	public static script = "src/recommendation/train.py";
	protected shell: PythonShell;
	protected available: boolean = false;
	protected curResult: number[] = new Array<number>();
	public constructor() {
		this.shell = new PythonShell(Recommender.script, {
			mode: "text",
			pythonPath: JSON.parse(FileSystem.readFileSync("settings.json").toString()).python.path
		});
		this.shell.on("message", message => {
			this.curResult = JSON.parse(message);
			this.available = true;
		})
	}
	public async execute(viewed: News[], candidates: News[]): Promise<number[]> {
		return new Promise(async (resolve, reject) => {
			let body: string = JSON.stringify({
				viewed: viewed.map(news => ({ title: news.title, content: news.content } as SimpleNews)),
				candidates: candidates.map(news => ({ title: news.title, content: news.content } as SimpleNews))
			});
			this.shell.send(`run ${body}`);
			new Promise<void>(resolve => {
				setInterval(() => {
					if (this.available)
						resolve();
				}, 100);
			}).then(() => {
				this.available = false;
				resolve(this.curResult)
			});
		})
	}
	public exit() {
		this.shell.send("exit").kill();
	}
}