import { and, rule } from 'graphql-shield'

import { UserRoles } from '@packages/enums/user'
import {
	type SessionRoleEntry,
	userHasCoachAccessForTeam,
	userHasOneOfRoles,
	userHasRecorderRole
} from '@packages/utils/sessionRoleAuth'

interface SessionUser {
	id: string
	roles?: SessionRoleEntry[]
	teams?: Array<{ id: string; ownerId: string }>
	companies?: Array<{ id: string; ownerId: string }>
}

interface SessionContext {
	req: {
		authClerkId?: string
		authUserId?: string
		headers?: {
			authorization?: string | string[]
		}
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
}): boolean =>
	!!ctx.req.authUserId || !!ctx.req.session.userId

const withPublicAccess = rule()(() => true)

const isAuthenticated = rule()(
	async (
		_parent: unknown,
		_args: unknown,
		ctx: SessionContext
	): Promise<boolean> => !!ctx.req.authUserId || !!ctx.req.session.userId
)

const isClerkOrAppAuthenticated = rule({ cache: 'no_cache' })(
	async (
		_parent: unknown,
		_args: unknown,
		ctx: SessionContext
	): Promise<boolean> => {
		const hasAuth =
			!!ctx.req?.authUserId ||
			!!ctx.req?.session?.userId ||
			!!ctx.req?.authClerkId ||
			!!ctx.req?.session?.clerkId

		if (hasAuth) {
			return true
		}

		const authorizationHeader = ctx.req?.headers?.authorization
		const hasAuthorization = Array.isArray(authorizationHeader)
			? authorizationHeader.length > 0
			: !!authorizationHeader
		throw new Error(
			[
				'auth_debug',
				`hasReq=${String(!!ctx.req)}`,
				`hasSession=${String(!!ctx.req?.session)}`,
				`hasAuthorization=${String(hasAuthorization)}`,
				`authClerkId=${ctx.req?.authClerkId ? 'set' : 'missing'}`,
				`sessionClerkId=${ctx.req?.session?.clerkId ? 'set' : 'missing'}`,
				`sessionUserId=${ctx.req?.session?.userId ? 'set' : 'missing'}`
			].join(' ')
		)
	}
)

const withTeamAccess = and(
	isAuthenticated,
	rule({ cache: 'contextual' })(
		async (
			_parent: unknown,
			args: WithTeamAccessArgs,
			ctx: SessionContext
		): Promise<boolean> => {
			const team = args.data?.team ?? args.team
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

		const { userId: sessionUserId, user } = ctx.req.session
		const userId = ctx.req.authUserId || sessionUserId
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

/** Team members may access, except recorder helpers. */
const withoutRecorderRole = rule({ cache: 'contextual' })(
	async (
		_parent: unknown,
		_args: unknown,
		ctx: SessionContext
	): Promise<boolean> =>
		!userHasRecorderRole({
			roles: ctx.req.session.user?.roles
		})
)

const withTeamAccessExceptRecorder = and(withTeamAccess, withoutRecorderRole)

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
		): Promise<boolean> =>
			(ctx.req.authUserId || ctx.req.session.userId) === userId
	)
)

export const authorizationRules = {
	isAuthenticated,
	isClerkOrAppAuthenticated,
	withPublicAccess,
	withTeamAccess,
	withTeamAccessExceptRecorder,
	withCompanyAccess,
	withManagerAccess,
	withCoachAccess,
	withAdminAccess,
	withOwnerAccess,
	isSelf
}
