# Static Redirect System Implementation Plan

## Overview
Create a clean redirect system for external URLs used in the application footer, providing URL ownership and future flexibility.

## Current External URLs
- GitHub profile: `https://github.com/ignaguri`
- PayPal donation: `https://www.paypal.me/ignacioguri`
- Bug reports: `https://prostcounter.canny.io/bugs`
- Feature requests: `https://prostcounter.canny.io/feature-requests`

## Implementation Plan

### 1. Create Redirect Pages (app/r/[slug]/page.tsx)
- Dynamic route for all redirects under `/r/` path
- Server-side redirects using Next.js `redirect()` function
- Predefined mapping for: `bugs`, `feedback`, `donate`, `github`

### 2. Update Footer Component
Change external URLs to internal redirect paths:
- `/r/bugs` → `https://prostcounter.canny.io/bugs`
- `/r/feedback` → `https://prostcounter.canny.io/feature-requests`  
- `/r/donate` → `https://www.paypal.me/ignacioguri`
- `/r/github` → `https://github.com/ignaguri`

### 3. Benefits
- **Clean URLs**: `/r/bugs` instead of external domains
- **Future Flexibility**: Easy to change destinations without app updates
- **Analytics Ready**: Foundation for tracking external link clicks
- **Consistent Branding**: All URLs start with prostcounter.com
- **URL Ownership**: Control over all redirect destinations

### 4. Implementation Details
- Server-side redirects (instant, no loading screens)
- TypeScript safety with predefined redirect mappings
- Fallback handling for invalid redirect slugs
- Maintains existing `target="_blank"` and `rel` attributes

## Alternative Approaches Considered

1. **Next.js Redirect Pages** - Simple page components that redirect client-side
2. **API Routes** - Server-side redirects with optional analytics
3. **next.config.js redirects** - Static redirects configured at build time
4. **Custom redirect pages** - With loading states and analytics

## When This Makes Sense
- Want detailed analytics on external link usage
- Plan to change external services frequently
- Want cleaner, memorable URLs
- Prefer consistency with domain branding
- Need future flexibility for URL management

## Status
- **Planning Phase** - Ready for implementation
- **Priority** - Low/Medium - Nice to have improvement
- **Effort** - Small - ~1 hour implementation