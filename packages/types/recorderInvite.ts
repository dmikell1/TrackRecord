export interface RecorderInviteInterface {
	id: string
	teamId: string
	email: string
	token: string
	status: string
	expiresAt: Date
	acceptedByUserId: string | null
	createdAt: Date
	updatedAt: Date
}
