import "basic-type-extensions";
import Recommender from "./shell";
import settings from "../config";
import News from "../entity/News";

interface Task {
	shell: Recommender;
	isBusy: boolean;
}
export default class ModelTaskAllocator {
	protected tasks: Map<number, Task>;
	public constructor() {
		this.tasks = new Map();
	}
	public async recommend(viewed: News[], candidates: News[]): Promise<Array<[News, number]>> {
		return new Promise(async (resolve, reject) => {
			viewed = viewed.shuffle().slice(0, settings.model.maxViewed);
			const batchSize = Math.ceil(candidates.length / settings.model.candidatesPerBatch);
			this.getTask(batchSize).then(task => {
				task.shell.execute(viewed, candidates).then(
					confidence => {
						const result = new Array<[News, number]>(candidates.length);
						for (let i = 0; i < candidates.length; ++i)
							result[i] = [candidates[i], confidence[i]];
						resolve(result.keySort(member => member[1]).reverse());
					},
					error => reject(error)
				)
			});
		})
	}
	public launch(): void {
		this.tasks.forEach(task => task.shell.launch());
	}
	public exit(): void {
		this.tasks.forEach(task => task.shell.exit());
	}
	protected async getTask(batchSize: number): Promise<Task> {
		return new Promise(async resolve => {
			if (this.tasks.has(batchSize)) {
				const task = this.tasks.get(batchSize);
				if (task.isBusy)
					await Promise.wait(() => !task.isBusy, settings.model.timerInterval);
				resolve(task);
			}
			else {
				const task: Task = {
					shell: new Recommender(batchSize),
					isBusy: false
				}
				this.tasks.set(batchSize, task);
				resolve(task);
			}
		});
	}
}