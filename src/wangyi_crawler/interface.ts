export interface ApiNewsInfo {
	path: string;
	image: string;
	title: string;
	passtime?: string;
}
export interface ApiResponse {
	code: number,
	message: string,
	result: ApiNewsInfo[]
}