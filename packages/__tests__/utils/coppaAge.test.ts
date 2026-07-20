import {
	getAgeFromDateOfBirth,
	isUnderCoppaAge
} from '@packages/utils/coppaAge'

describe('coppaAge', () => {
	it('calculates age from date of birth', () => {
		const age = getAgeFromDateOfBirth({
			dateOfBirth: new Date('2010-01-01T00:00:00.000Z'),
			asOf: new Date('2026-01-01T00:00:00.000Z')
		})

		expect(age).toBe(16)
	})

	it('identifies under-13 athletes', () => {
		expect(
			isUnderCoppaAge({
				dateOfBirth: new Date('2015-06-01T00:00:00.000Z'),
				asOf: new Date('2026-07-01T00:00:00.000Z')
			})
		).toBe(true)

		expect(
			isUnderCoppaAge({
				dateOfBirth: new Date('2010-06-01T00:00:00.000Z'),
				asOf: new Date('2026-07-01T00:00:00.000Z')
			})
		).toBe(false)
	})
})
