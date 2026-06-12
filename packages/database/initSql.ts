/** Runs on connect when syncSchema is true (e.g. tests). Production should use migrations. */
export const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	clerk_id varchar(255),
	first_name varchar(45) NOT NULL,
	last_name varchar(45) NOT NULL,
	email varchar(255) NOT NULL UNIQUE,
	avatar text NOT NULL,
	status varchar(50) NOT NULL,
	invited_by_id uuid REFERENCES users(id),
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	owner_id uuid NOT NULL REFERENCES users(id),
	name varchar(45) NOT NULL,
	settings jsonb NOT NULL DEFAULT '{}',
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	name varchar(45) NOT NULL,
	owner_id uuid NOT NULL REFERENCES users(id),
	company_id uuid NOT NULL REFERENCES companies(id),
	settings jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS company_users (
	company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
	user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_users (
	team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
	user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
	role varchar(50) NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_company_idx ON user_roles(user_id, company_id);

CREATE TABLE IF NOT EXISTS session (
	sid varchar NOT NULL COLLATE "default",
	sess json NOT NULL,
	expire timestamptz(6) NOT NULL,
	CONSTRAINT session_pkey PRIMARY KEY (sid)
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
`
