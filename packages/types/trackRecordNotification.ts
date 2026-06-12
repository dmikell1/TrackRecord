export interface TrackRecordNotificationInterface {
	id: string
	userId: string
	teamId: string
	type: string
	text: string
	read: boolean
	payload: Record<string, unknown> | null
	createdAt: Date
}
