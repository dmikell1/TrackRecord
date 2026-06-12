import { AthleteInviteStatus, JoinInviteKind } from '@packages/enums/trackRecord'

export interface JoinInfoInterface {
	kind: JoinInviteKind
	teamId: string
	teamName: string
	email?: string | null
	firstName?: string | null
	lastName?: string | null
	status?: AthleteInviteStatus | null
}
