import { UserRoles } from '@packages/enums/user'
import {
	userHasCoachAccessForTeam,
	userHasOneOfRoles,
	userHasRecorderRole
} from '@packages/utils/sessionRoleAuth'

describe('sessionRoleAuth', () => {
	describe('userHasOneOfRoles', () => {
		it('should match owner roles stored as objects', () => {
			const allowed = userHasOneOfRoles({
				roles: [{ role: UserRoles.Owner }],
				allowedRoles: [UserRoles.Owner, UserRoles.Admin]
			})

			expect(allowed).toBe(true)
		})

		it('should match roles stored as enum values', () => {
			const allowed = userHasOneOfRoles({
				roles: [UserRoles.Manager],
				allowedRoles: [UserRoles.Manager]
			})

			expect(allowed).toBe(true)
		})

		it('should deny when roles are missing', () => {
			const allowed = userHasOneOfRoles({
				roles: undefined,
				allowedRoles: [UserRoles.Owner]
			})

			expect(allowed).toBe(false)
		})

		it('should deny non-coach roles', () => {
			const allowed = userHasOneOfRoles({
				roles: [{ role: UserRoles.User }],
				allowedRoles: [UserRoles.Owner, UserRoles.Manager]
			})

			expect(allowed).toBe(false)
		})
	})

	describe('userHasRecorderRole', () => {
		it('should return true for recorder helpers', () => {
			expect(
				userHasRecorderRole({
					roles: [{ role: UserRoles.Recorder }]
				})
			).toBe(true)
		})

		it('should return false for coaches and athletes', () => {
			expect(
				userHasRecorderRole({
					roles: [{ role: UserRoles.Owner }]
				})
			).toBe(false)
			expect(
				userHasRecorderRole({
					roles: [{ role: UserRoles.User }]
				})
			).toBe(false)
		})
	})

	describe('userHasCoachAccessForTeam', () => {
		it('should allow team owners without role records', () => {
			const allowed = userHasCoachAccessForTeam({
				userId: 'coach-1',
				teamId: 'team-1',
				teams: [{ id: 'team-1', ownerId: 'coach-1' }],
				companies: [],
				roles: []
			})

			expect(allowed).toBe(true)
		})

		it('should allow company owners without role records', () => {
			const allowed = userHasCoachAccessForTeam({
				userId: 'coach-1',
				teamId: 'team-1',
				teams: [{ id: 'team-1', ownerId: 'other-user' }],
				companies: [{ ownerId: 'coach-1' }],
				roles: []
			})

			expect(allowed).toBe(true)
		})

		it('should deny athletes on the team', () => {
			const allowed = userHasCoachAccessForTeam({
				userId: 'athlete-1',
				teamId: 'team-1',
				teams: [{ id: 'team-1', ownerId: 'coach-1' }],
				companies: [{ ownerId: 'coach-1' }],
				roles: [{ role: UserRoles.User }]
			})

			expect(allowed).toBe(false)
		})

		it('should deny Recorder helpers coach mutations', () => {
			const allowed = userHasCoachAccessForTeam({
				userId: 'recorder-1',
				teamId: 'team-1',
				teams: [{ id: 'team-1', ownerId: 'coach-1' }],
				companies: [{ ownerId: 'coach-1' }],
				roles: [{ role: UserRoles.Recorder }]
			})

			expect(allowed).toBe(false)
		})
	})
})
