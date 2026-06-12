import { injectable, inject, singleton } from 'tsyringe'

import type { CompanyFilter } from '@packages/repositories/company/CompanyRepository'
import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { CompanyInterface, TeamInterface, UserInterface } from '@packages/types'

interface CreateCompanyData {
	name: string
	ownerId: string
	settings?: {
		timezoneName?: string
	}
}

@injectable()
@singleton()
@ReportErrors()
export class CompanyService {
	constructor(
		@inject(CompanyRepository)
		private companyRepository: CompanyRepository,
		@inject(ReportingService)
		private reportingService: ReportingService
	) {}

	public async createCompany({
		data
	}: {
		data: CreateCompanyData
	}): Promise<{
		company: CompanyInterface
		user: UserInterface | null
		team: TeamInterface
	}> {
		const { ownerId, name, settings } = data

		const { company: createdCompany, team } =
			await this.companyRepository.createCompanyTeamAndLinks({
				ownerId,
				name,
				settings
			})

		const hydrated = await this.companyRepository.hydrateCompanyMembers({
			companyId: createdCompany.id,
			ownerId
		})

		const company: CompanyInterface = {
			...createdCompany,
			users: hydrated.users,
			teams: hydrated.teams
		}

		const user = hydrated.users?.[0] ?? null

		this.reportingService.log({ message: `created team: ${team.id}` })
		this.reportingService.log({ message: `created company: ${company.id}` })

		return { company, user, team }
	}

	public async findCompany({
		filter
	}: {
		filter: CompanyFilter
	}): Promise<CompanyInterface | null> {
		return this.companyRepository.findOne({ filter })
	}

	public async findCompanies({
		filter
	}: {
		filter: CompanyFilter
	}): Promise<CompanyInterface[]> {
		return this.companyRepository.find({ filter })
	}

	public async findCompanyOrFail({
		filter
	}: {
		filter: CompanyFilter
	}): Promise<CompanyInterface> {
		const company = await this.companyRepository.findOne({ filter })
		if (!company) {
			const error = new Error(
				`No company found with filter: ${JSON.stringify(filter)}`
			)
			this.reportingService.reportError({ error })
			throw error
		}

		return company
	}

	public async updateCompany({
		filter,
		data
	}: {
		filter: CompanyFilter
		data: Partial<Pick<CompanyInterface, 'name' | 'settings'>>
	}): Promise<CompanyInterface | null> {
		return this.companyRepository.update({ filter, data })
	}

	public async deleteCompany({
		filter
	}: {
		filter: CompanyFilter
	}): Promise<boolean> {
		return this.companyRepository.delete({ filter })
	}

	public async countCompanies({
		filter
	}: {
		filter: CompanyFilter
	}): Promise<number> {
		return this.companyRepository.count({ filter })
	}
}
