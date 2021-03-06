export interface Article {
	single_mode: boolean,
	abstract: string,
	middle_mode: boolean,
	more_mode: boolean,
	tag: string,
	comments_count: number,
	tag_url: string,
	title: string,
	chinese_tag: string,
	source: string,
	group_source: number,
	has_gallery: boolean,
	media_url: string,
	media_avatar_url: string,
	image_list: { url: string }[],
	source_url: string,
	article_genre: string,
	item_id: string,
	is_feed_ad: boolean,
	behot_time: number,
	image_url?: string,
	group_id: string,
	middle_image: string
}
export interface Video {
	single_mode: boolean,
	abstract: string,
	middle_mode: boolean,
	more_mode: boolean,
	tag: string,
	has_gallery: boolean,
	tag_url: string,
	title: string,
	has_video: boolean,
	chinese_tag: string,
	source: string,
	group_source: number,
	comments_count: number,
	media_url: string,
	media_avatar_url: string,
	video_duration_str: string,
	source_url: string,
	article_genre: string,
	item_id: string,
	is_feed_ad: boolean,
	video_id: string,
	behot_time: number,
	image_url: string,
	video_play_count: number,
	group_id: string,
	middle_image: string
}
export interface UGC {
	is_feed_ad: boolean,
	tag_url: string,
	ugc_data: {
		read_count: number,
		ugc_images: [
			string
		],
		ugc_user: {
			open_url: string,
			user_id: number,
			name: string,
			avatar_url: string,
			is_following: boolean,
			is_self: boolean,
			user_verified: number,
			user_auth_info: {
				auth_type: string,
				auth_info: string
			}
		},
		rich_content: string,
		show_count: number,
		digg_count: number,
		content: string,
		comment_count: number,
		show_text: string,
		display_count: number
	},
	title: string,
	single_mode: boolean,
	middle_mode: boolean,
	tag: string,
	behot_time: number,
	source_url: string,
	source: string,
	more_mode: boolean,
	article_genre: string,
	image_url: string,
	has_gallery: boolean,
	group_source: number,
	item_id: string,
	comments_count: number,
	group_id: string,
	middle_image: string,
	media_url: string
}
export interface Response {
	data: (Article | Video | UGC)[],
	has_more: boolean,
	message: string,
	next: {
		max_behot_time: number
	}
}
export enum Catogory {
	All = '__all__',
	Hot = 'news_hot',
	Society = 'news_society',
	Entertainment = 'news_entertainment',
	Technology = 'news_tech',
	Military = 'news_military',
	Sports = 'news_sports',
	Automobile = 'news_car',
	Finance = 'news_finance',
	Globe = 'news_world',
	Fashion = 'news_fashion',
	Tour = 'news_travel',
	Exploration = 'news_discovery',
	Parenting = 'news_baby',
	Regimen = 'news_regimen',
	Story = 'news_story',
	Essay = 'news_essay',
	Game = 'news_game',
	History = 'news_history',
	Food = 'news_food',
}