import type { CompanyInterface } from './company'
import type { TeamSettingsInterface } from './teamSettings'
import type { UserInterface } from './user'

export interface TeamData {
	name: string
	companyId: string
	company?: CompanyInterface
	ownerId: string
	owner?: UserInterface
	users?: UserInterface[]
	settings: TeamSettingsInterface
	createdAt?: Date
	updatedAt?: Date
}

export interface TeamInterface extends TeamData {
	id: string
}
