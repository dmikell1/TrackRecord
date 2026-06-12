import { fail, warn, danger } from 'danger'

const { modified_files } = danger.git

const packageChanged = modified_files.includes('package.json')
const lockfileChanged = modified_files.includes('package-lock.json')

if (packageChanged && !lockfileChanged) {
	warn(
		`Changes were made to package.json, but not to package-lock.json - <i>'Perhaps you need to run "npm install"?'</i>`
	)
}

const modifiedEnvVars =
	modified_files.includes('src/environment/index.ts') ||
	modified_files.includes('.example.env')

if (modifiedEnvVars) {
	warn(
		`It looks like you may have changed environment variables. Please ensure they are set in the deployed environment before merging!`
	)
}

if (danger.github.pr.title.includes('WIP')) {
	fail('PR is marked as WIP and should not be merged')
}
