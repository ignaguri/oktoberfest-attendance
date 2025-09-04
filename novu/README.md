# Novu Workflows

This directory contains all Novu notification workflows for the ProstCounter app.

## Workflow Sync Process

With the Novu Framework approach, workflows are automatically synced through the bridge endpoint.

### Local Development

**Note**: The Novu Framework approach requires a tunnel for local development, which can be unreliable. For now, workflows are synced during deployment.

1. Start your Next.js app: `pnpm dev` (runs on port 3008)
2. The bridge endpoint is available at: http://localhost:3008/api/novu
3. For local testing, you can trigger workflows directly via the API

**Alternative**: Use the old API-based approach for local development if needed.

### Production Deployment

The sync happens automatically when you deploy your app:

1. Deploy your Next.js app with the `/api/novu` endpoint
2. Set environment variables:
   - `NOVU_API_KEY`: Your Novu API key
   - `NOVU_BRIDGE_URL`: Your production URL + `/api/novu` (e.g., `https://your-app.com/api/novu`)
3. GitHub Actions will automatically sync on push to main

### Manual Sync

To manually sync workflows:

```bash
# Local
pnpm novu:sync

# Production (with env vars set)
npx novu@latest sync --bridge-url https://your-app.com/api/novu --secret-key YOUR_API_KEY
```

## Key Differences from Old Approach

1. **No more manual API calls** - The Framework handles all the sync logic
2. **Workflows defined with `workflow()` function** - Type-safe and validated
3. **Bridge endpoint serves workflows** - Novu pulls from your app instead of pushing to Novu
4. **Automatic payload validation** - Zod schemas are converted to JSON Schema automatically

## Workflows

- `group-join.ts` - Notifies group members when someone joins
- `tent-check-in.ts` - Sends notifications for tent check-ins
- `reservation-reminder.ts` - Reminds users about reservations
- `reservation-prompt.ts` - Prompts users to check in after reservation time
- `achievement-unlocked.ts` - Personal achievement notifications
- `group-achievement-unlocked.ts` - Group achievement notifications
