import { createClerkClient } from '@clerk/backend'
import { inject, injectable, singleton } from 'tsyringe'

import { UserStatus } from '@packages/enums'
import type {
	UserFilter,
	UserRelationLoad
} from '@packages/repositories/user/UserRepository'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { UserInterface } from '@packages/types'
import { env } from '@packages/utils/validateEnvs'

interface CreateUserData {
	firstName: string
	lastName: string
	email: string
	avatar: string
	status?: UserStatus
	termsAndConditions: boolean
	clerkId?: string
}

@injectable()
@singleton()
@ReportErrors()
export class UserService {
	constructor(
		@inject(UserRepository) private userRepository: UserRepository,
		@inject(ReportingService)
		private reportingService: ReportingService
	) {}

	public async createUser({
		userData
	}: {
		userData: CreateUserData
	}): Promise<UserInterface> {
		return this.userRepository.create({
			data: {
				firstName: userData.firstName,
				lastName: userData.lastName,
				email: userData.email,
				avatar: userData.avatar,
				status: userData.status ?? UserStatus.Pending,
				...(userData.clerkId !== undefined && { clerkId: userData.clerkId })
			}
		})
	}

	public async findUser({
		filter,
		relations
	}: {
		filter: UserFilter
		relations?: UserRelationLoad
	}): Promise<UserInterface | null> {
		return this.userRepository.findOne({ filter, relations })
	}

	public async findUsers({
		filter,
		relations
	}: {
		filter: UserFilter
		relations?: UserRelationLoad
	}): Promise<UserInterface[]> {
		return this.userRepository.find({ filter, relations })
	}

	public async findUserOrFail({
		filter,
		relations
	}: {
		filter: UserFilter
		relations?: UserRelationLoad
	}): Promise<UserInterface> {
		const user = await this.userRepository.findOne({ filter, relations })
		if (!user) {
			const error = new Error(
				`No user found with filter: ${JSON.stringify(filter)}`
			)
			this.reportingService.reportError({ error })
			throw error
		}

		return user
	}

	public async getUserById({ id }: { id: string }): Promise<UserInterface> {
		try {
			const user = await this.userRepository.findOne({
				filter: { id }
			})
			if (!user) {
				const error = new Error(`User not found with id: ${id}`)
				this.reportingService.reportError({ error })
				throw error
			}
			return user
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async getUserByClerkId({
		clerkId
	}: {
		clerkId: string
	}): Promise<UserInterface | null> {
		try {
			return await this.userRepository.findByClerkId({ clerkId })
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async syncUserFromClerk({
		clerkId,
		userData
	}: {
		clerkId: string
		userData: {
			firstName?: string
			lastName?: string
			email?: string
			avatar?: string
		}
	}): Promise<UserInterface> {
		try {
			const existingUser = await this.userRepository.findByClerkId({
				clerkId
			})

			if (!existingUser) {
				const error = new Error(`User not found with clerkId: ${clerkId}`)
				this.reportingService.reportError({ error })
				throw error
			}

			const updatedUser = await this.userRepository.update({
				filter: { clerkId },
				data: {
					...(userData.firstName !== undefined && {
						firstName: userData.firstName
					}),
					...(userData.lastName !== undefined && {
						lastName: userData.lastName
					}),
					...(userData.email !== undefined && { email: userData.email }),
					...(userData.avatar !== undefined && { avatar: userData.avatar })
				}
			})

			if (!updatedUser) {
				const error = new Error(
					`Failed to update user with clerkId: ${clerkId}`
				)
				this.reportingService.reportError({ error })
				throw error
			}

			return updatedUser
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async updateUser({
		filter,
		data
	}: {
		filter: UserFilter
		data: Partial<
			Pick<
				UserInterface,
				'firstName' | 'lastName' | 'email' | 'avatar' | 'status' | 'clerkId'
			>
		>
	}): Promise<UserInterface | null> {
		try {
			return await this.userRepository.update({ filter, data })
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async deleteUser({
		filter
	}: {
		filter: UserFilter
	}): Promise<boolean> {
		return this.userRepository.delete({ filter })
	}

	/**
	 * Deletes the authenticated user's Clerk account and app data.
	 * Owned companies/teams (and cascaded content) are removed.
	 */
	public async deleteMyAccount({
		userId
	}: {
		userId: string
	}): Promise<boolean> {
		try {
			const user = await this.userRepository.findOneOrFail({
				filter: { id: userId }
			})

			// Remove auth first so the session cannot be reused while cleanup runs.
			if (user.clerkId) {
				await this.deleteClerkUser({ clerkId: user.clerkId })
			}

			const deleted = await this.userRepository.deleteAccountData({
				userId
			})
			if (!deleted) {
				throw new Error('Failed to delete account data')
			}

			this.reportingService.log({
				message: 'User account deleted',
				userId
			})

			return true
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	private async deleteClerkUser({
		clerkId
	}: {
		clerkId: string
	}): Promise<void> {
		if (!env.CLERK_SECRET_KEY) {
			throw new Error('CLERK_SECRET_KEY is not configured')
		}
		const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
		await client.users.deleteUser(clerkId)
	}

	public async countUsers({ filter }: { filter: UserFilter }): Promise<number> {
		return this.userRepository.count({ filter })
	}
}
