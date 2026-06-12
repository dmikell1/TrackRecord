import gql from 'graphql-tag'

export const root = gql`
	type Query {
		root: String
	}
	type Mutation {
		root: String
	}
	type Subscription {
		root: String
	}

	scalar DateTime
`
