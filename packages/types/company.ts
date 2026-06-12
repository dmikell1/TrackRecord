import type { TeamInterface } from './team'
import type { UserInterface } from './user'

export interface CompanyData {
	name: string
	ownerId: string
	owner?: UserInterface
	teams?: TeamInterface[]
	users?: UserInterface[]
	settings: CompanySettingsInterface
	createdAt?: Date
	updatedAt?: Date
}

export interface CompanySettingsInterface {
	timezoneName?: string
}

export interface CompanyInterface extends CompanyData {
	id: string
}
