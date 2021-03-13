import FileSystem = require("fs");
import { PythonShell } from "python-shell"
import News from "../entity/News"

interface SimpleNews {
	title: string;
	content: string;
}
export default class Recommender {
	public static python = "D:/Program Files/Python/3.7.9/python.exe";
	public static script = "src/recommendation/train.py";
	protected shell: PythonShell;
	protected available: boolean = false;
	protected curResult: number[] = new Array<number>();
	public constructor() {
		this.shell = new PythonShell(Recommender.script, {
			mode: "text",
			pythonPath: Recommender.python
		});
		this.shell.on("message", message => {
			this.curResult = JSON.parse(message);
			this.available = true;
		})
	}
	public async execute(viewed: News[], candidates: News[]): Promise<number[]> {
		return new Promise(async (resolve, reject) => {
			let body: string = JSON.stringify({
				viewed: viewed.map(news => ({ title: news.title, content: "" } as SimpleNews)),
				candidates: candidates.map(news => ({ title: news.title, content: "" } as SimpleNews))
			});
			this.shell.send(`run ${body}`);
			FileSystem.writeFileSync("src/recommendation/data.txt", `run ${body}`)
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