import { BulkAthleteImportIssueReason } from '@packages/enums/trackRecord'
import { ParentalConsentStatus } from '@packages/enums/trackRecord'
import type { AthleteInviteInterface } from '@packages/types/athleteInvite'

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
	dateOfBirth: Date | null
	parentalConsentStatus: ParentalConsentStatus
	parentEmail: string | null
	parentalConsentToken: string | null
	parentalConsentAt: Date | null
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
	inviteEmailsFailed: BulkAthleteImportRowResult[]
}

export interface CreateAthleteInviteResult {
	invite: AthleteInviteInterface
	emailSent: boolean
}

export interface CreateAthleteResult {
	athlete: AthleteInterface
	invite: AthleteInviteInterface | null
	inviteEmailSent: boolean | null
}

export interface ParentalConsentInfoInterface {
	athleteFirstName: string
	athleteLastName: string
	teamName: string
	status: ParentalConsentStatus
}
