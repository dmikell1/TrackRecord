import { BulkAthleteImportIssueReason } from '@packages/enums/trackRecord'

export interface AthleteInterface {
	id: string
	teamId: string
	companyId: string
	userId: string | null
	firstName: string
	lastName: string
	email: string
	phone: string | null
	color: string
	deletedAt: Date | null
	createdAt: Date
	updatedAt: Date
}

export interface BulkAthleteRowInput {
	firstName: string
	lastName: string
	email: string
	phone?: string
}

export interface BulkAthleteImportRowResult {
	row: number
	email: string
	reason: BulkAthleteImportIssueReason
}

export interface BulkCreateAthletesResult {
	created: AthleteInterface[]
	skipped: BulkAthleteImportRowResult[]
	failed: BulkAthleteImportRowResult[]
}
