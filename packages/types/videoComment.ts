export interface VideoCommentInterface {
	id: string
	videoId: string
	userId: string
	text: string
	stampSeconds: number | null
	createdAt: Date
}
