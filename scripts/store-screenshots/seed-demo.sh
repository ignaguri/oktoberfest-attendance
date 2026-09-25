#!/usr/bin/env bash
# Rebuild the screenshot demo world on local Supabase. Run right before capturing:
# the feed shows only the last 48h and the home crowd card only the last ~30 min.
# Order of capture: Home first, then `psql < demo-tent-picker-crowd.sql` for the tent-picker shot.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)/seed"
cd "$(git -C "$HERE" rev-parse --show-toplevel)"
PSQL="docker exec -i supabase_db_prost-counter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL < "$HERE/demo-seed.sql"
$PSQL < "$HERE/demo-hero-plans.sql"

# Real achievement evaluator, so unlocks match the seeded data.
cat > packages/api/.demo-eval.mts <<'TS'
import { createClient } from "@supabase/supabase-js";
import { AchievementMetricsRepository } from "./src/repositories/supabase/achievement-metrics.repository";
import { AchievementService } from "./src/services/achievement.service";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: festivals } = await supabase.from("festivals").select("id").in("short_name", ["oktoberfest-2025", "oktoberfest-2026"]);
const service = new AchievementService(new AchievementMetricsRepository(supabase as never));
for (let n = 1; n <= 9; n++) for (const f of festivals ?? []) await service.evaluateAndUnlock(`de000000-0000-4000-a000-00000000000${n}`, f.id);
TS
KEY="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' apps/web/.env.local | cut -d= -f2-)"
(cd packages/api && SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY="$KEY" pnpm dlx tsx .demo-eval.mts) || true
rm -f packages/api/.demo-eval.mts

$PSQL < "$HERE/demo-post-eval.sql"
$PSQL < "$HERE/demo-locations.sql"
echo "Demo world ready. Sign in as demo.sophie@example.com / password"
