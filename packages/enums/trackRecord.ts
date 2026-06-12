export enum SessionType {
	Meet = 'Meet',
	Practice = 'Practice'
}

export enum CoachingLevel {
	MiddleSchool = 'MiddleSchool',
	HighSchool = 'HighSchool',
	College = 'College',
	Professional = 'Professional',
	Club = 'Club'
}

export enum EventGroup {
	Sprints = 'Sprints',
	MiddleDistance = 'MiddleDistance',
	Distance = 'Distance',
	Hurdles = 'Hurdles',
	VerticalJumps = 'VerticalJumps',
	HorizontalJumps = 'HorizontalJumps',
	Throws = 'Throws',
	Relays = 'Relays',
	Specialty = 'Specialty'
}

export enum ScoringDirection {
	Higher = 'Higher',
	Lower = 'Lower'
}

export enum TrackEvent {
	HighJump = 'HighJump',
	PoleVault = 'PoleVault',
	LongJump = 'LongJump',
	TripleJump = 'TripleJump',
	ShotPut = 'ShotPut',
	Discus = 'Discus',
	Javelin = 'Javelin',
	Hammer = 'Hammer',
	M60 = 'M60',
	M100 = 'M100',
	M200 = 'M200',
	M300 = 'M300',
	M400 = 'M400',
	M500 = 'M500',
	M600 = 'M600',
	M800 = 'M800',
	M1000 = 'M1000',
	M1500 = 'M1500',
	M1600 = 'M1600',
	M3000 = 'M3000',
	M3200 = 'M3200',
	M5000 = 'M5000',
	M10000 = 'M10000',
	Mile = 'Mile',
	TwoMile = 'TwoMile',
	M60H = 'M60H',
	M100H = 'M100H',
	M110H = 'M110H',
	M300H = 'M300H',
	M400H = 'M400H',
	M300IH = 'M300IH',
	M400LH = 'M400LH',
	Steeplechase = 'Steeplechase',
	M4x100 = 'M4x100',
	M4x200 = 'M4x200',
	M4x400 = 'M4x400',
	M4x800 = 'M4x800',
	SprintMedley = 'SprintMedley',
	DistanceMedley = 'DistanceMedley',
	RaceWalk = 'RaceWalk'
}

export enum VideoResultType {
	Foul = 'Foul',
	Mark = 'Mark',
	VerticalHeights = 'VerticalHeights',
	Time = 'Time',
	DNF = 'DNF',
	DQ = 'DQ'
}

export enum AthleteInviteStatus {
	Pending = 'Pending',
	Accepted = 'Accepted',
	Expired = 'Expired'
}

export enum JoinInviteKind {
	Athlete = 'Athlete',
	Team = 'Team'
}

export enum BulkAthleteImportIssueReason {
	MissingName = 'MissingName',
	InvalidEmail = 'InvalidEmail',
	DuplicateInBatch = 'DuplicateInBatch',
	AlreadyOnTeam = 'AlreadyOnTeam'
}
