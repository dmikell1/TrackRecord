import { injectable, inject, singleton } from 'tsyringe'

import { BulkAthleteImportIssueReason } from '@packages/enums/trackRecord'
import type { AthleteFilter } from '@packages/repositories/athlete/AthleteRepository'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { VideoPerformanceRepository } from '@packages/repositories/videoPerformance/VideoPerformanceRepository'
import { AthleteInviteService } from '@packages/services/athleteInvite/AthleteInviteService'
import ReportErrors, {
	NoTrace
} from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { pickRandomAthleteColor } from '@packages/utils/athleteColor'
import type {
	AthleteInterface,
	BulkAthleteImportRowResult,
	BulkAthleteRowInput,
	BulkCreateAthletesResult
} from '@packages/types/athlete'

const MAX_BULK_ATHLETES = 50

@injectable()
@singleton()
@ReportErrors()
export class AthleteService {
	constructor(
		@inject(AthleteRepository) private athleteRepository: AthleteRepository,
		@inject(TeamRepository) private teamRepository: TeamRepository,
		@inject(VideoRepository) private videoRepository: VideoRepository,
		@inject(VideoPerformanceRepository)
		private videoPerformanceRepository: VideoPerformanceRepository,
		@inject(AthleteInviteService)
		private athleteInviteService: AthleteInviteService,
		@inject(ReportingService) private reportingService: ReportingService
	) {}

	public async createAthlete({ data }: {
		data: Pick<AthleteInterface, 'teamId' | 'companyId' | 'firstName' | 'lastName' | 'email' | 'color'> &
			Partial<Pick<AthleteInterface, 'userId' | 'phone'>>
	}): Promise<AthleteInterface> {
		return this.athleteRepository.create({ data })
	}

	public async bulkCreateAthletes({
		teamId,
		companyId,
		athletes,
		sendInvites = false
	}: {
		teamId: string
		companyId: string
		athletes: BulkAthleteRowInput[]
		sendInvites?: boolean
	}): Promise<BulkCreateAthletesResult> {
		if (athletes.length === 0) {
			return { created: [], skipped: [], failed: [] }
		}

		if (athletes.length > MAX_BULK_ATHLETES) {
			throw new Error(`Cannot import more than ${MAX_BULK_ATHLETES} athletes at once`)
		}

		const team = await this.teamRepository.findOne({ filter: { id: teamId } })
		if (!team) {
			throw new Error('Team not found')
		}

		if (team.companyId !== companyId) {
			throw new Error('Team does not belong to the specified company')
		}

		const skipped: BulkAthleteImportRowResult[] = []
		const failed: BulkAthleteImportRowResult[] = []
		const emailsInBatch = new Set<string>()
		const rowsToCreate: Array<{
			row: number
			data: Pick<
				AthleteInterface,
				'teamId' | 'companyId' | 'firstName' | 'lastName' | 'email' | 'color'
			> &
				Partial<Pick<AthleteInterface, 'phone'>>
		}> = []

		const normalizedRows = athletes.map((athlete, index) => ({
			row: index,
			firstName: athlete.firstName.trim(),
			lastName: athlete.lastName.trim(),
			email: athlete.email.trim().toLowerCase(),
			phone: athlete.phone?.trim() ?? ''
		}))

		const candidateEmails = normalizedRows
			.filter(row => this.isValidAthleteEmail({ email: row.email }))
			.map(row => row.email)

		const existingAthletes = await this.athleteRepository.findByEmailsInTeam({
			teamId,
			emails: candidateEmails
		})
		const existingEmails = new Set(
			existingAthletes.map(athlete => athlete.email.toLowerCase())
		)

		for (const row of normalizedRows) {
			if (!row.firstName || !row.lastName) {
				failed.push({
					row: row.row,
					email: row.email,
					reason: BulkAthleteImportIssueReason.MissingName
				})
				continue
			}

			if (!this.isValidAthleteEmail({ email: row.email })) {
				failed.push({
					row: row.row,
					email: row.email,
					reason: BulkAthleteImportIssueReason.InvalidEmail
				})
				continue
			}

			if (emailsInBatch.has(row.email)) {
				skipped.push({
					row: row.row,
					email: row.email,
					reason: BulkAthleteImportIssueReason.DuplicateInBatch
				})
				continue
			}

			if (existingEmails.has(row.email)) {
				skipped.push({
					row: row.row,
					email: row.email,
					reason: BulkAthleteImportIssueReason.AlreadyOnTeam
				})
				continue
			}

			emailsInBatch.add(row.email)
			rowsToCreate.push({
				row: row.row,
				data: {
					teamId,
					companyId,
					firstName: row.firstName,
					lastName: row.lastName,
					email: row.email,
					color: pickRandomAthleteColor(),
					...(row.phone.length > 0 && { phone: row.phone })
				}
			})
		}

		const created = await this.athleteRepository.createMany({
			data: rowsToCreate.map(entry => entry.data)
		})

		if (sendInvites) {
			await Promise.all(
				created.map(athlete =>
					this.athleteInviteService.createAthleteInvite({
						teamId,
						email: athlete.email
					})
				)
			)
		}

		return { created, skipped, failed }
	}

	public async findAthlete({ filter }: { filter: AthleteFilter }): Promise<AthleteInterface | null> {
		return this.athleteRepository.findOne({ filter })
	}

	public async findAthleteOrFail({ filter }: { filter: AthleteFilter }): Promise<AthleteInterface> {
		const athlete = await this.athleteRepository.findOne({ filter })
		if (!athlete) {
			const error = new Error(`No athlete found with filter: ${JSON.stringify(filter)}`)
			this.reportingService.reportError({ error })
			throw error
		}
		return athlete
	}

	public async findAthletes({ filter }: { filter: AthleteFilter }): Promise<AthleteInterface[]> {
		return this.athleteRepository.find({ filter })
	}

	public async updateAthlete({ filter, data }: {
		filter: AthleteFilter
		data: Partial<Pick<AthleteInterface, 'firstName' | 'lastName' | 'email' | 'phone' | 'color'>>
	}): Promise<AthleteInterface | null> {
		return this.athleteRepository.update({ filter, data })
	}

	public async deleteAthlete({
		id,
		teamId,
		deleteVideos
	}: {
		id: string
		teamId: string
		deleteVideos: boolean
	}): Promise<boolean> {
		const existing = await this.athleteRepository.findOne({
			filter: { id, teamId }
		})

		if (!existing) {
			const error = new Error(`Athlete with id ${id} not found`)
			this.reportingService.reportError({ error })
			throw error
		}

		if (deleteVideos) {
			await this.videoPerformanceRepository.deleteByAthleteId({
				athleteId: id,
				teamId
			})
			await this.videoRepository.deleteByAthleteId({ athleteId: id, teamId })
		}

		const deleted = await this.athleteRepository.softDelete({ id, teamId })

		if (deleted !== null && existing.userId) {
			await this.teamRepository.removeTeamUser({
				teamId,
				userId: existing.userId
			})
		}

		return deleted !== null
	}

	public async linkUserToAthlete({ id, userId }: { id: string; userId: string }): Promise<AthleteInterface | null> {
		return this.athleteRepository.linkUser({ id, userId })
	}

	@NoTrace()
	private isValidAthleteEmail({ email }: { email: string }): boolean {
		return email.length > 0 && email.includes('@') && email.includes('.')
	}
}
