# CLAUDE FEATURES & FLOWS - ProstCounter

**CONTEXT**: Detailed feature descriptions and user flows for the precursor project. Use as reference for T4 stack implementation.

## AUTHENTICATION_FLOWS

### SIGN_UP_FLOW
1. User visits `/sign-up`
2. Supabase Auth UI form (email + password)
3. Email confirmation required
4. Auto-redirect to `/home` after confirmation
5. Profile creation with username/full_name prompts

### SIGN_IN_FLOW
1. User visits `/sign-in` 
2. Supabase Auth UI (email + password)
3. Optional "Remember me" functionality
4. Redirect to `/home` on success
5. Error handling for invalid credentials

### PROFILE_MANAGEMENT
- **Location**: `/profile`
- **Features**: 
  - Update username, full_name
  - Avatar upload to Supabase storage
  - Password change functionality
  - Account deletion option

## HOME_DASHBOARD_FEATURES

### OKTOBERFEST_STATUS_WIDGET
- Shows current date vs festival dates (2024-09-21 to 2024-10-06)
- Status indicators: "Before", "During", "After" festival
- Conditional rendering of attendance features

### QUICK_ATTENDANCE_REGISTRATION
- **Trigger**: Only shows during festival period
- **Form Fields**:
  - Date selector (defaults to today)
  - Beer count input (number)
  - Optional tent selection
- **Action**: Creates attendance + tent_visit records
- **Feedback**: Toast notification on success/error

### HIGHLIGHTS_SECTION
- Personal statistics dashboard:
  - Total days attended
  - Total beers consumed
  - Average beers per day
  - Money spent (beer_count * €16.2)
- Dynamic calculations from user's attendance data

### MISSING_FIELDS_PROMPTS
- Checks for incomplete profile (username, full_name)
- Contextual prompts to complete profile
- Direct links to profile page

### NAVIGATION_BUTTONS
- "My attendances" → `/attendance`
- "Join or Create a group" → `/groups` 
- "Global Leaderboard" → `/leaderboard`
- "Oktoberfest Map" → External link to wiesnmap.muenchen.de
- Share app button (native sharing API)

## ATTENDANCE_MANAGEMENT

### DETAILED_ATTENDANCE_FORM
- **Location**: `/attendance`
- **Features**:
  - Date picker with calendar UI
  - Beer count input with validation
  - Tent selector (multi-select)
  - Beer photo upload (multiple files)
  - Time-specific tent visits
- **Actions**: Create/Update attendance records
- **Validation**: Date within festival range, positive beer count

### PERSONAL_ATTENDANCE_TABLE
- **Data Display**:
  - Sortable table by date
  - Beer count per day
  - Tent visits with timestamps
  - Photo thumbnails
  - Edit/Delete actions per row
- **Interactions**:
  - Click row to edit attendance
  - Delete confirmation dialogs
  - Photo gallery modal view

### BEER_PICTURES_UPLOAD
- **Integration**: Part of attendance form
- **Features**:
  - Multiple file selection
  - Image preview before upload
  - Supabase storage integration
  - Automatic linking to attendance_id
- **Validation**: File type, size limits

## GROUP_SYSTEM_FLOWS

### CREATE_GROUP_FLOW
1. User fills form: group name, winning criteria selection
2. System generates unique invite_token
3. Creator becomes first group member
4. Redirect to group detail page
5. Share invite token with friends

### JOIN_GROUP_FLOW  
1. User receives invite token (URL or code)
2. Enters token in join form
3. System validates token exists
4. User added to group_members
5. Access to group features unlocked

### GROUP_DETAIL_PAGE
- **Location**: `/groups/[id]`
- **Features**:
  - Group member list with stats
  - Leaderboard based on winning_criteria
  - Group gallery (all member photos)
  - Invite management (share token)
  - Leave group option

### GROUP_SETTINGS_ADMIN
- **Location**: `/group-settings/[id]` 
- **Permissions**: Group creator only
- **Features**:
  - Change group name
  - Update winning criteria
  - Remove members
  - Regenerate invite token
  - Delete group

### GROUP_GALLERY_FEATURE
- **Location**: `/groups/[id]/gallery`
- **Organization**: Photos grouped by date, then by user
- **Display**: Grid layout with user attribution
- **Interactions**: 
  - Click photo for fullscreen modal
  - Filter by date range
  - Filter by specific user

## LEADERBOARD_SYSTEM

### GLOBAL_LEADERBOARD
- **Location**: `/leaderboard`
- **Rankings**:
  - Most days attended
  - Most total beers
  - Best average beers/day
- **Data**: All users across platform
- **Display**: Ranked table with user stats

### GROUP_LEADERBOARDS  
- **Context**: Within group detail pages
- **Criteria**: Based on group's winning_criteria setting
- **Features**:
  - Real-time ranking updates
  - Member-only visibility
  - Progress tracking

## ADMIN_PANEL_FEATURES

### USER_MANAGEMENT
- **Location**: `/admin` (super admin only)
- **Features**:
  - User list with search/filter
  - View user statistics
  - Delete user accounts
  - Reset user passwords

### GROUP_MANAGEMENT
- **Features**:
  - All groups overview
  - Group member counts
  - Delete problematic groups
  - View group statistics

### CACHE_MANAGEMENT
- **Features**:
  - Clear application cache
  - Refresh leaderboard data
  - Force data synchronization

### IMAGE_CONVERSION_TOOLS
- **Features**:
  - Batch image processing
  - Format conversion utilities
  - Storage optimization tools

## DATA_FLOWS

### ATTENDANCE_CREATION_FLOW
1. User submits attendance form
2. Validate date uniqueness per user
3. Create attendance record
4. Create tent_visit records if tents selected  
5. Upload and link beer_pictures
6. Update user statistics cache
7. Refresh group leaderboards
8. Send success notification

### LEADERBOARD_CALCULATION_FLOW
1. Triggered by attendance changes
2. Aggregate user statistics:
   - Count distinct dates (days_attended)
   - Sum beer_count (total_beers)  
   - Calculate avg_beers (total/days)
3. Update cached rankings
4. Refresh UI components

### GROUP_COMPETITION_FLOW
1. Group members log attendances
2. System calculates stats per winning_criteria
3. Rankings updated in real-time
4. Winners determined by criteria:
   - days_attended: Most unique dates
   - total_beers: Highest sum of beer_count
   - avg_beers: Highest (total_beers / days_attended)

## ERROR_HANDLING_PATTERNS

### FORM_VALIDATION
- Client-side: Formik + Yup schema validation
- Server-side: Supabase RLS policies
- Real-time feedback with error states

### NETWORK_ERROR_HANDLING
- Toast notifications for API failures
- Retry mechanisms for critical operations
- Offline detection and messaging

### AUTHENTICATION_ERRORS
- Session expiry redirects
- Invalid token handling  
- Permission denied states

## PWA_FEATURES

### OFFLINE_CAPABILITIES
- Service worker caching strategies
- Offline page when no network
- Background sync for pending uploads

### INSTALL_PROMPTS
- Browser install banner
- Custom install button on home
- iOS-specific install instructions

### PERFORMANCE_OPTIMIZATIONS
- Image lazy loading
- Route-based code splitting
- API response caching

## STYLING_THEME_SYSTEM

### COLOR_PALETTE_PRIMARY
```css
/* Brand Colors - Yellow Theme */
--color-brand: theme(colors.yellow.400);           /* #FBBF24 */
yellow-400: #FBBF24  /* Primary brand color */
yellow-500: #F59E0B  /* Secondary brand, hover states */
yellow-600: #D97706  /* Dark variant, text emphasis */
yellow-700: #B45309  /* Darker hover states */
```

### COLOR_PALETTE_SEMANTIC
```css
/* Tailwind CSS Variables */
--background: 0 0% 100%;           /* White background */
--foreground: 222.2 84% 4.9%;      /* Near black text */
--card: 0 0% 100%;                 /* White cards */
--card-foreground: 222.2 84% 4.9%; /* Card text */
--primary: 222.2 47.4% 11.2%;      /* Dark blue-gray */
--primary-foreground: 210 40% 98%; /* Light text on primary */
--secondary: 210 40% 96.1%;        /* Light gray */
--muted: 210 40% 96.1%;            /* Muted backgrounds */
--muted-foreground: 215.4 16.3% 46.9%; /* Muted text */
--destructive: 0 84.2% 60.2%;      /* Red for errors */
--border: 214.3 31.8% 91.4%;       /* Light border */
--input: 214.3 31.8% 91.4%;        /* Input borders */
--ring: 222.2 84% 4.9%;            /* Focus rings */
```

### DARK_MODE_PALETTE
```css
.dark {
  --background: 222.2 84% 4.9%;      /* Dark background */
  --foreground: 210 40% 98%;         /* Light text */
  --card: 222.2 84% 4.9%;           /* Dark cards */
  --primary: 210 40% 98%;           /* Light primary */
  --secondary: 217.2 32.6% 17.5%;   /* Dark gray */
  --muted: 217.2 32.6% 17.5%;      /* Dark muted */
  --border: 217.2 32.6% 17.5%;     /* Dark borders */
}
```

### BUTTON_VARIANT_COLORS
```typescript
// Button color variants from button.tsx
variants: {
  variant: {
    default: "bg-primary text-primary-foreground hover:bg-primary/90"
    yellow: "bg-yellow-400 text-primary hover:bg-yellow-500"
    yellowOutline: "border border-yellow-400 bg-transparent text-primary hover:bg-yellow-400"
    darkYellow: "bg-yellow-600 text-white hover:bg-yellow-700"
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80"
    ghost: "hover:bg-accent hover:text-accent-foreground"
    outline: "border border-input bg-background hover:bg-accent"
  }
}
```

### CUSTOM_CSS_CLASSES
```css
/* Global custom styles from globals.css */
.button-base {
  width: fit-content;
  border-radius: 9999px;        /* Fully rounded */
  border-width: 2px;
  padding-inline: 2rem;
  padding-block: 0.5rem;
  font-weight: 700;
}

.button {
  border-color: var(--color-brand);    /* Yellow border */
  background-color: white;
  color: var(--color-brand);           /* Yellow text */
  
  &:hover {
    background-color: var(--color-brand); /* Yellow background */
    color: white;
  }
}

.button-inverse {
  border-color: white;
  background-color: var(--color-brand); /* Yellow background */
  color: white;
  
  &:hover {
    border-color: var(--color-brand);
    background-color: white;
    color: var(--color-brand);         /* Yellow text */
  }
}

.card {
  background-color: white;
  border-radius: 1rem;               /* 16px rounded */
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  padding: 2rem 1rem;
  gap: 2rem;
}

.input {
  border-radius: 0.75rem;            /* 12px rounded */
  border: 1px solid var(--color-gray-400);
  
  &:focus {
    border-color: var(--color-brand);  /* Yellow focus */
    ring-color: var(--color-brand);
  }
}

.link {
  color: var(--color-brand);          /* Yellow links */
  font-weight: 600;
}
```

### TYPOGRAPHY_BRANDING
```css
/* App branding styles */
.app-title {
  font-size: 3rem;                   /* text-5xl */
  font-weight: 800;                  /* font-extrabold */
}

.app-title .prost {
  color: theme(colors.yellow.600);    /* #D97706 */
}

.app-title .counter {
  color: theme(colors.yellow.500);    /* #F59E0B */
}

h2 {
  padding-block: 1rem;
  font-size: 2.25rem;                /* text-4xl */
  line-height: 2.5rem;
  font-weight: 900;
  color: var(--color-gray-900);
}

.heading {
  font-size: 1.125rem;               /* text-lg */
  line-height: 1.75rem;
  font-weight: 600;
  color: var(--color-gray-700);
}
```

### COMPONENT_SPECIFIC_COLORS
```css
/* Error states */
.error {
  color: theme(colors.red.600);      /* #DC2626 */
}

.input-error {
  border-color: theme(colors.red.500);    /* #EF4444 */
  background-color: theme(colors.red.50); /* #FEF2F2 */
  color: theme(colors.red.900);           /* #7F1D1D */
}

/* Highlights and code blocks */
.highlight {
  background-color: var(--color-gray-50);  /* #F9FAFB */
  border-radius: 0.5rem;
  padding: 0.5rem;
  font-family: ui-monospace, monospace;
}
```

### RESPONSIVE_BREAKPOINTS
```css
/* Mobile-first responsive design */
@media (min-width: 640px) {  /* sm: */
  .card {
    min-width: 24rem;          /* 384px */
    padding-inline: 2.5rem;    /* 40px */
  }
}

/* Container max-widths */
.max-w-lg { max-width: 32rem; }     /* 512px */
.max-w-xl { max-width: 36rem; }     /* 576px */ 
.max-w-2xl { max-width: 42rem; }    /* 672px */
```

### SHADCN_UI_CUSTOMIZATIONS
```typescript
// components.json configuration
{
  "style": "new-york",
  "tailwind": {
    "baseColor": "slate",
    "cssVariables": true
  }
}
```

### FESTIVAL_THEMED_ELEMENTS
```css
/* Oktoberfest-specific styling */
.beer-emoji {
  font-size: 2rem;
  role: "img";
  aria-label: "beer";
}

.festival-status {
  /* Dynamic styling based on festival dates */
  /* Before: muted colors */
  /* During: bright yellow/active colors */
  /* After: faded/historical colors */
}
```