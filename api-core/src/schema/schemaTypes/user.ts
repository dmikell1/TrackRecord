import gql from 'graphql-tag'

export const User = gql`
	extend type Query {
		me: User
	}

	extend type Mutation {
		deleteMyAccount: Boolean!
	}

	type User {
		id: ID!
		firstName: String!
		lastName: String!
		avatar: String!
		email: String!
		teams: [Team!]!
		companies: [Company!]!
		roles: [UserRoles!]!
	}

	type UserRoles {
		role: UserRole!
		company: Company!
	}

	enum UserRole {
		Admin
		User
		Manager
		InternalEmployee
		Owner
		Beta
		Recorder
	}
`
