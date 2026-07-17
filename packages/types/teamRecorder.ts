import { TeamRecorderStatus } from '@packages/enums/trackRecord'

export interface TeamRecorderEntryInterface {
	id: string
	email: string
	displayName: string
	status: TeamRecorderStatus
	userId: string | null
	inviteId: string | null
}
