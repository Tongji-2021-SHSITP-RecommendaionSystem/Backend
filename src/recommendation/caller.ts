import Process = require("child_process");
import FileSystem = require("fs");
import News from "../entity/News"

interface SimpleNews {
	title: string;
	content: string;
}
export default class Recommender {
	public static python = "D:/Program Files/Python/3.7.9/python.exe";
	public static script = "src/recommendation/train.py";
	public static input = "src/recommendation/input.json";
	protected process: Process.ChildProcess;
	protected available: boolean = false;
	protected curResult: number[] = new Array<number>();
	public constructor() {
		this.connect();
	}
	private connect() {
		this.process = Process.spawn(Recommender.python, [Recommender.script], { windowsHide: true });
		this.process.stdout.on("data", data => {
			this.curResult = JSON.parse(data.toString());
			this.available = true;
		});
	}
	public async execute(viewed: News[], candidates: News[]): Promise<number[]> {
		if (!this.process.connected)
			this.connect();
		return new Promise((resolve, reject) => {
			let body: string = JSON.stringify({
				viewed: viewed.map(news => ({ title: news.title, content: news.content } as SimpleNews)),
				candidates: candidates.map(news => ({ title: news.title, content: news.content } as SimpleNews))
			});
			FileSystem.writeFile(Recommender.input, body, {}, error => {
				if (error)
					return reject(error);
				else {
					this.process.stdin.write("run\n");
					new Promise<void>(resolve => {
						setInterval(() => {
							if (this.available)
								resolve();
						}, 100);
					}).then(() => {
						this.available = false;
						resolve(this.curResult)
					});
				}
			})
		})
	}
	public exit() {
		this.process.stdin.write("exit\n");
		this.process.disconnect();
	}
}