export interface TestScenario {
  name: string;
  url: string;
  description: string;
  requiresAuth: boolean;
  mobileOptimized?: boolean;
  expectedMetrics?: {
    lcp?: number; // Largest Contentful Paint (ms)
    cls?: number; // Cumulative Layout Shift
    tbt?: number; // Total Blocking Time (ms)
  };
}

export interface AuthenticatedFlow {
  name: string;
  description: string;
  steps: FlowStep[];
  expectedMetrics?: {
    lcp?: number;
    cls?: number;
    tbt?: number;
  };
}

export interface FlowStep {
  action: "navigate" | "click" | "type" | "wait" | "upload" | "scroll";
  target?: string;
  value?: string;
  waitTime?: number;
  description: string;
}

// Test user credentials (from CLAUDE.md seed data)
export const TEST_USER = {
  email: "user9@example.com",
  password: "password",
} as const;

// Public pages that don't require authentication
export const PUBLIC_SCENARIOS: TestScenario[] = [
  {
    name: "Landing Page",
    url: "/",
    description: "Main landing page with app introduction",
    requiresAuth: false,
    mobileOptimized: true,
    expectedMetrics: {
      lcp: 2500,
      cls: 0.1,
      tbt: 200,
    },
  },
  {
    name: "Sign In",
    url: "/sign-in",
    description: "User authentication page",
    requiresAuth: false,
    mobileOptimized: true,
    expectedMetrics: {
      lcp: 2000,
      cls: 0.05,
      tbt: 150,
    },
  },
  {
    name: "Sign Up",
    url: "/sign-up",
    description: "User registration page",
    requiresAuth: false,
    mobileOptimized: true,
    expectedMetrics: {
      lcp: 2000,
      cls: 0.05,
      tbt: 150,
    },
  },
];

// Authenticated page scenarios
export const AUTHENTICATED_SCENARIOS: TestScenario[] = [
  {
    name: "Home Dashboard",
    url: "/home",
    description: "Main dashboard with quick beer registration",
    requiresAuth: true,
    mobileOptimized: true,
    expectedMetrics: {
      lcp: 3000,
      cls: 0.15,
      tbt: 300,
    },
  },
  {
    name: "Attendance Tracking",
    url: "/attendance",
    description: "Detailed attendance management with photo uploads",
    requiresAuth: true,
    mobileOptimized: true,
    expectedMetrics: {
      lcp: 3500,
      cls: 0.2,
      tbt: 400,
    },
  },
  {
    name: "Groups Management",
    url: "/groups",
    description: "Group creation and management interface",
    requiresAuth: true,
    mobileOptimized: true,
    expectedMetrics: {
      lcp: 3000,
      cls: 0.15,
      tbt: 350,
    },
  },
  {
    name: "Profile Settings",
    url: "/profile",
    description: "User profile and account settings",
    requiresAuth: true,
    mobileOptimized: true,
    expectedMetrics: {
      lcp: 2500,
      cls: 0.1,
      tbt: 250,
    },
  },
  {
    name: "Achievements",
    url: "/achievements",
    description: "Gamification system with progress bars and badges",
    requiresAuth: true,
    mobileOptimized: true,
    expectedMetrics: {
      lcp: 3500,
      cls: 0.25, // Higher due to progress animations
      tbt: 450,
    },
  },
  {
    name: "Global Leaderboard",
    url: "/leaderboard",
    description: "Festival-scoped global rankings",
    requiresAuth: true,
    mobileOptimized: true,
    expectedMetrics: {
      lcp: 3000,
      cls: 0.1,
      tbt: 300,
    },
  },
];

// Complex user flows that involve multiple interactions
export const AUTHENTICATED_FLOWS: AuthenticatedFlow[] = [
  {
    name: "Quick Beer Registration",
    description: "Sign in → Home → Register beer → Upload photo",
    steps: [
      {
        action: "navigate",
        target: "/sign-in",
        description: "Go to sign-in page",
      },
      {
        action: "type",
        target: '[name="email"]',
        value: TEST_USER.email,
        description: "Enter email",
      },
      {
        action: "type",
        target: '[name="password"]',
        value: TEST_USER.password,
        description: "Enter password",
      },
      {
        action: "click",
        target: 'button[type="submit"]',
        description: "Submit login",
      },
      {
        action: "wait",
        waitTime: 2000,
        description: "Wait for redirect to home",
      },
      {
        action: "click",
        target: '[data-testid="quick-register-btn"]',
        description: "Click quick register",
      },
      {
        action: "type",
        target: '[name="beer_count"]',
        value: "2",
        description: "Enter beer count",
      },
      {
        action: "click",
        target: 'button[type="submit"]',
        description: "Submit registration",
      },
      { action: "wait", waitTime: 1000, description: "Wait for success" },
    ],
    expectedMetrics: {
      lcp: 4000,
      cls: 0.2,
      tbt: 500,
    },
  },
  {
    name: "Group Join and Leaderboard",
    description: "Join group → View leaderboard → Check gallery",
    steps: [
      {
        action: "navigate",
        target: "/groups",
        description: "Go to groups page",
      },
      {
        action: "click",
        target: '[data-testid="join-group-btn"]',
        description: "Click join group",
      },
      {
        action: "type",
        target: '[name="invite_token"]',
        value: "test-token",
        description: "Enter invite token",
      },
      {
        action: "click",
        target: 'button[type="submit"]',
        description: "Submit join request",
      },
      { action: "wait", waitTime: 2000, description: "Wait for group join" },
      {
        action: "navigate",
        target: "/leaderboard",
        description: "Go to leaderboard",
      },
      {
        action: "wait",
        waitTime: 2000,
        description: "Wait for leaderboard load",
      },
    ],
    expectedMetrics: {
      lcp: 3500,
      cls: 0.15,
      tbt: 400,
    },
  },
  {
    name: "Festival Switching Performance",
    description: "Switch between festivals and measure data loading",
    steps: [
      { action: "navigate", target: "/home", description: "Go to home page" },
      {
        action: "click",
        target: '[data-testid="festival-selector"]',
        description: "Open festival selector",
      },
      {
        action: "click",
        target: '[data-testid="festival-option-2024"]',
        description: "Switch to 2024 festival",
      },
      { action: "wait", waitTime: 3000, description: "Wait for data reload" },
      {
        action: "click",
        target: '[data-testid="festival-selector"]',
        description: "Open festival selector again",
      },
      {
        action: "click",
        target: '[data-testid="festival-option-2025"]',
        description: "Switch back to 2025",
      },
      { action: "wait", waitTime: 3000, description: "Wait for data reload" },
    ],
    expectedMetrics: {
      lcp: 4000,
      cls: 0.3, // Higher due to data switching
      tbt: 600,
    },
  },
  {
    name: "Achievement System Performance",
    description: "Load achievements with progress animations",
    steps: [
      {
        action: "navigate",
        target: "/achievements",
        description: "Go to achievements page",
      },
      {
        action: "wait",
        waitTime: 3000,
        description: "Wait for achievements to load",
      },
      {
        action: "scroll",
        target: "body",
        value: "500",
        description: "Scroll to load more achievements",
      },
      {
        action: "wait",
        waitTime: 2000,
        description: "Wait for scroll animations",
      },
      {
        action: "click",
        target: '[data-testid="achievement-card"]',
        description: "Click achievement for details",
      },
      {
        action: "wait",
        waitTime: 1000,
        description: "Wait for modal animation",
      },
    ],
    expectedMetrics: {
      lcp: 4000,
      cls: 0.4, // Highest due to progress bar animations
      tbt: 500,
    },
  },
];

// Device configurations for testing
export const DEVICE_CONFIGS = {
  mobile: {
    name: "Mobile",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
  },
  tablet: {
    name: "Tablet",
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
  },
  desktop: {
    name: "Desktop",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  },
} as const;

// Network conditions for testing
export const NETWORK_CONDITIONS = {
  "3G": {
    name: "3G",
    downloadThroughput: 1638.4,
    uploadThroughput: 675,
    latency: 300,
  },
  "4G": {
    name: "4G",
    downloadThroughput: 9000,
    uploadThroughput: 9000,
    latency: 150,
  },
  fast: {
    name: "Fast",
    downloadThroughput: 100000,
    uploadThroughput: 100000,
    latency: 50,
  },
} as const;
