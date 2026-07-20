import { differenceInYears } from 'date-fns'

import { ParentalConsentStatus } from '@packages/enums/trackRecord'

export const COPPA_AGE_THRESHOLD = 13

export const getAgeFromDateOfBirth = ({
	dateOfBirth,
	asOf = new Date()
}: {
	dateOfBirth: Date
	asOf?: Date
}): number => {
	return differenceInYears(asOf, dateOfBirth)
}

export const isUnderCoppaAge = ({
	dateOfBirth,
	asOf
}: {
	dateOfBirth: Date
	asOf?: Date
}): boolean => {
	return getAgeFromDateOfBirth({ dateOfBirth, asOf }) < COPPA_AGE_THRESHOLD
}

export const athleteCanInteract = ({
	parentalConsentStatus
}: {
	parentalConsentStatus: ParentalConsentStatus | string
}): boolean => {
	return parentalConsentStatus !== ParentalConsentStatus.Pending
}
