import { and, rule } from 'graphql-shield'

import { UserRoles } from '@packages/enums/user'
import {
	type SessionRoleEntry,
	userHasCoachAccessForTeam,
	userHasOneOfRoles
} from '@packages/utils/sessionRoleAuth'

interface SessionUser {
	id: string
	roles?: SessionRoleEntry[]
	teams?: Array<{ id: string; ownerId: string }>
	companies?: Array<{ id: string; ownerId: string }>
}

interface SessionContext {
	req: {
		session: {
			userId: string
			clerkId?: string
			user?: SessionUser
		}
	}
}

interface WithTeamAccessArgs {
	data?: {
		team?: string
	}
	team?: string
}

interface WithCompanyAccessArgs {
	data?: {
		company?: string
	}
	company?: string
}

export { UserRoles }

export const userExistsOnContext = ({
	ctx
}: {
	ctx: SessionContext
}): boolean => !!ctx.req.session.userId

const withPublicAccess = rule()(() => true)

const isAuthenticated = rule()(
	async (
		_parent: unknown,
		_args: unknown,
		ctx: SessionContext
	): Promise<boolean> => !!ctx.req.session.userId
)

const isClerkOrAppAuthenticated = rule()(
	async (
		_parent: unknown,
		_args: unknown,
		ctx: SessionContext
	): Promise<boolean> =>
		!!ctx.req.session.userId || !!ctx.req.session.clerkId
)

const withTeamAccess = and(
	isAuthenticated,
	rule({ cache: 'contextual' })(
		async (
			_parent: unknown,
			args: WithTeamAccessArgs,
			ctx: SessionContext
		): Promise<boolean> => {
			const team = args.data ? args.data.team : args.team
			return (
				ctx.req.session.user?.teams?.some((t) => t.id === team) === true ||
				userHasOneOfRoles({
					roles: ctx.req.session.user?.roles,
					allowedRoles: [UserRoles.InternalEmployee]
				})
			)
		}
	)
)

const withCompanyAccess = and(
	isAuthenticated,
	rule({ cache: 'contextual' })(
		async (
			_parent: unknown,
			args: WithCompanyAccessArgs,
			ctx: SessionContext
		): Promise<boolean> => {
			const company = args.data ? args.data.company : args.company
			return (
				ctx.req.session.user?.companies?.[0]?.id === company ||
				userHasOneOfRoles({
					roles: ctx.req.session.user?.roles,
					allowedRoles: [UserRoles.InternalEmployee]
				})
			)
		}
	)
)

const withManagerAccess = and(
	isAuthenticated,
	rule({ cache: 'contextual' })(
		async (
			_parent: unknown,
			_args: unknown,
			ctx: SessionContext
		): Promise<boolean> =>
			userHasOneOfRoles({
				roles: ctx.req.session.user?.roles,
				allowedRoles: [
					UserRoles.InternalEmployee,
					UserRoles.Owner,
					UserRoles.Admin,
					UserRoles.Manager
				]
			})
	)
)

const withCoachRoleForTeam = rule({ cache: 'contextual' })(
	async (
		_parent: unknown,
		args: WithTeamAccessArgs,
		ctx: SessionContext
	): Promise<boolean> => {
		const teamId = args.data?.team ?? args.team
		if (!teamId) {
			return false
		}

		const { userId, user } = ctx.req.session
		if (!userId) {
			return false
		}

		return userHasCoachAccessForTeam({
			userId,
			teamId,
			teams: user?.teams,
			companies: user?.companies,
			roles: user?.roles
		})
	}
)

const withCoachAccess = and(withTeamAccess, withCoachRoleForTeam)

const withAdminAccess = and(
	isAuthenticated,
	rule({ cache: 'contextual' })(
		async (
			_parent: unknown,
			_args: unknown,
			ctx: SessionContext
		): Promise<boolean> =>
			userHasOneOfRoles({
				roles: ctx.req.session.user?.roles,
				allowedRoles: [
					UserRoles.InternalEmployee,
					UserRoles.Owner,
					UserRoles.Admin
				]
			})
	)
)

const withOwnerAccess = and(
	isAuthenticated,
	rule({ cache: 'contextual' })(
		async (
			_parent: unknown,
			_args: unknown,
			ctx: SessionContext
		): Promise<boolean> =>
			userHasOneOfRoles({
				roles: ctx.req.session.user?.roles,
				allowedRoles: [UserRoles.InternalEmployee, UserRoles.Owner]
			})
	)
)

const isSelf = and(
	isAuthenticated,
	rule({ cache: 'contextual' })(
		async (
			_parent: unknown,
			{ userId }: { userId: string },
			ctx: SessionContext
		): Promise<boolean> => ctx.req.session.userId === userId
	)
)

export const authorizationRules = {
	isAuthenticated,
	isClerkOrAppAuthenticated,
	withPublicAccess,
	withTeamAccess,
	withCompanyAccess,
	withManagerAccess,
	withCoachAccess,
	withAdminAccess,
	withOwnerAccess,
	isSelf
}
