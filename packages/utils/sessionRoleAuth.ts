import { UserRoles } from '@packages/enums/user'

export type SessionRoleEntry = UserRoles | { role: UserRoles }

export const resolveSessionRole = ({
	entry
}: {
	entry: SessionRoleEntry
}): UserRoles => (typeof entry === 'string' ? entry : entry.role)

export const userHasOneOfRoles = ({
	roles,
	allowedRoles
}: {
	roles?: SessionRoleEntry[]
	allowedRoles: UserRoles[]
}): boolean =>
	roles?.some((entry) =>
		allowedRoles.includes(resolveSessionRole({ entry }))
	) === true

export const userHasRecorderRole = ({
	roles
}: {
	roles?: SessionRoleEntry[]
}): boolean =>
	userHasOneOfRoles({
		roles,
		allowedRoles: [UserRoles.Recorder]
	})

const COACH_ROLES: UserRoles[] = [
	UserRoles.Owner,
	UserRoles.Admin,
	UserRoles.Manager
]

export const userHasCoachAccessForTeam = ({
	userId,
	teamId,
	teams,
	companies,
	roles
}: {
	userId: string
	teamId: string
	teams?: Array<{ id: string; ownerId: string }>
	companies?: Array<{ ownerId: string }>
	roles?: SessionRoleEntry[]
}): boolean => {
	if (
		userHasOneOfRoles({
			roles,
			allowedRoles: [UserRoles.InternalEmployee]
		})
	) {
		return true
	}

	const isTeamOwner =
		teams?.some((team) => team.id === teamId && team.ownerId === userId) ===
		true
	if (isTeamOwner) {
		return true
	}

	const isCompanyOwner =
		companies?.some((company) => company.ownerId === userId) === true
	if (isCompanyOwner) {
		return true
	}

	return userHasOneOfRoles({
		roles,
		allowedRoles: COACH_ROLES
	})
}
