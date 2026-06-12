import Chance from 'chance'

import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { CompanyService } from '@packages/services/company/CompanyService'
import { CompanyInterface } from '@packages/types'
import { CompanyData } from '@packages/types/company'

const chance = new Chance(String(process.env.CHANCE_SEED))

export const createMockCompanyInput = ({
	ownerId,
	overrides = {}
}: {
	ownerId: string
	overrides?: Partial<Pick<CompanyInterface, 'name' | 'settings'>>
}): {
	name: string
	ownerId: string
	settings?: { timezoneName?: string }
} => ({
	name: chance.company(),
	ownerId,
	settings: {
		timezoneName: chance.timezone().name
	},
	...overrides
})

export const createMockCompanyData = (
	overrides: Partial<CompanyData> = {}
): CompanyData => ({
	name: chance.company(),
	ownerId: overrides.ownerId ?? '',
	settings: {
		timezoneName: chance.timezone().name
	},
	...overrides
})

export const createMockCompanyRepository = (): jest.Mocked<CompanyRepository> =>
	({
		create: jest.fn(),
		findOne: jest.fn(),
		find: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		count: jest.fn(),
		createCompanyTeamAndLinks: jest.fn(),
		hydrateCompanyMembers: jest.fn()
	}) as unknown as jest.Mocked<CompanyRepository>

export const createMockCompanyService = (): jest.Mocked<CompanyService> =>
	({
		createCompany: jest.fn(),
		findCompany: jest.fn(),
		findCompanies: jest.fn(),
		findCompanyOrFail: jest.fn(),
		updateCompany: jest.fn(),
		deleteCompany: jest.fn(),
		countCompanies: jest.fn()
	}) as unknown as jest.Mocked<CompanyService>

const createMockReportingService = (): jest.Mocked<ReportingService> =>
	({
		reportError: jest.fn()
	}) as unknown as jest.Mocked<ReportingService>

export const createTestCompanyService = (): CompanyService => {
	const mockCompanyRepository = createMockCompanyRepository()
	const mockReportingService = createMockReportingService()
	return new CompanyService(mockCompanyRepository, mockReportingService)
}

export const setupTestCompany = async ({
	companyRepository,
	ownerId,
	overrides = {}
}: {
	companyRepository: CompanyRepository
	ownerId: string
	overrides?: Partial<Pick<CompanyInterface, 'name' | 'settings'>>
}): Promise<CompanyInterface> => {
	const input = createMockCompanyInput({ ownerId, overrides })
	return companyRepository.create({
		data: {
			ownerId: input.ownerId,
			name: input.name,
			settings: input.settings ?? {}
		}
	})
}
