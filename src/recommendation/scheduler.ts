import "basic-type-extensions";
import Recommender from "./shell";
import settings from "../config";
import News from "../entity/News";

interface Task {
	shell: Recommender;
	isBusy: boolean;
	hasExited: boolean;
}
export default class ModelTaskScheduler {
	protected tasks: Array<Task>;
	public constructor() {
		this.tasks = new Array<Task>(settings.model.concurrency);
		for (let i = 0; i < settings.model.concurrency; ++i)
			this.tasks[i] = {
				shell: new Recommender(),
				isBusy: false,
				hasExited: false
			}
	}
	protected async schedule(viewed: News[], candidates: News[], confidence: number[], startIndex: number): Promise<void> {
		function attempt(tasks: Task[]): boolean {
			for (const task of tasks) {
				if (!task.isBusy) {
					task.isBusy = true;
					task.shell.execute(viewed, candidates).then(result => {
						result.forEach((value, index) => confidence[startIndex + index] = value);
						task.isBusy = false;
					})
					return true;
				}
			}
			return false;
		}
		return new Promise(resolve => {
			if (attempt(this.tasks))
				resolve();
			else {
				const timer = setInterval(
					() => {
						if (attempt(this.tasks)) {
							clearInterval(timer);
							resolve();
						}
					},
					settings.model.timerInterval
				)
			}
		})
	}
	public async recommend(viewed: News[], candidates: News[]): Promise<Array<[News, number]>> {
		this.launch();
		return new Promise(async (resolve, reject) => {
			const confidence = new Array<number>(candidates.length);
			viewed = viewed.slice(0, settings.model.maxViewed);
			let groupsCount = Math.ceil(candidates.length / settings.model.maxCandidates);
			for (let i = 0; i < groupsCount; ++i) {
				let startIndex = i * settings.model.maxCandidates;
				await this.schedule(viewed, candidates.slice(startIndex, startIndex + settings.model.maxCandidates), confidence, startIndex)
			}
			await new Promise<void>(resolve => {
				const timer = setInterval(
					() => {
						if (this.tasks.every(task => !task.isBusy)) {
							clearInterval(timer);
							resolve();
						}
					},
					settings.model.timerInterval
				);
			});
			const result = new Array<[News, number]>(candidates.length);
			for (let i = 0; i < candidates.length; ++i)
				result[i] = [candidates[i], confidence[i]];
			resolve(result.keySort(member => member[1]).reverse());
		})
	}
	public launch(): void {
		for (const task of this.tasks)
			if (task.hasExited) {
				task.shell = new Recommender();
				task.hasExited = false;
			}
	}
	public exit(): void {
		for (const task of this.tasks)
			if (!task.hasExited) {
				task.shell.exit();
				task.hasExited = true;
			}
	}
}