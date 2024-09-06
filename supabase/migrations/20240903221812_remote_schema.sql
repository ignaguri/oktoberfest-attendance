alter type "auth"."factor_type" rename to "factor_type__old_version_to_be_dropped";

create type "auth"."factor_type" as enum ('totp', 'webauthn', 'phone');

alter table "auth"."mfa_factors" alter column factor_type type "auth"."factor_type" using factor_type::text::"auth"."factor_type";

drop type "auth"."factor_type__old_version_to_be_dropped";

alter table "auth"."audit_log_entries" enable row level security;

alter table "auth"."flow_state" enable row level security;

alter table "auth"."identities" enable row level security;

alter table "auth"."instances" enable row level security;

alter table "auth"."mfa_amr_claims" enable row level security;

alter table "auth"."mfa_challenges" add column "otp_code" text;

alter table "auth"."mfa_challenges" enable row level security;

alter table "auth"."mfa_factors" add column "last_challenged_at" timestamp with time zone;

alter table "auth"."mfa_factors" add column "phone" text;

alter table "auth"."mfa_factors" enable row level security;

alter table "auth"."one_time_tokens" enable row level security;

alter table "auth"."refresh_tokens" enable row level security;

alter table "auth"."saml_providers" enable row level security;

alter table "auth"."saml_relay_states" enable row level security;

alter table "auth"."schema_migrations" enable row level security;

alter table "auth"."sessions" enable row level security;

alter table "auth"."sso_domains" enable row level security;

alter table "auth"."sso_providers" enable row level security;

alter table "auth"."users" enable row level security;

CREATE UNIQUE INDEX mfa_factors_last_challenged_at_key ON auth.mfa_factors USING btree (last_challenged_at);

CREATE UNIQUE INDEX mfa_factors_phone_key ON auth.mfa_factors USING btree (phone);

CREATE UNIQUE INDEX unique_verified_phone_factor ON auth.mfa_factors USING btree (user_id, phone);

alter table "auth"."mfa_factors" add constraint "mfa_factors_last_challenged_at_key" UNIQUE using index "mfa_factors_last_challenged_at_key";

alter table "auth"."mfa_factors" add constraint "mfa_factors_phone_key" UNIQUE using index "mfa_factors_phone_key";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();


