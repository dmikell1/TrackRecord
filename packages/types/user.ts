import { UserStatus, UserRoles } from '@packages/enums'

import type { CompanyInterface } from './company'
import type { TeamInterface } from './team'

export interface UserData {
	firstName: string
	lastName: string
	email: string
	avatar: string
	clerkId?: string | null
	createdAt?: Date
	updatedAt?: Date
	status: UserStatus
	invitedById?: string | null
	companies?: CompanyInterface[]
	teams?: TeamInterface[]
	roles?: {
		role: UserRoles
		companyId: string
		company?: CompanyInterface
	}[]
}

export interface UserInterface extends UserData {
	id: string
}
