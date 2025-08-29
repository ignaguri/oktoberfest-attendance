# 🍻 ProstCounter Performance Testing Suite

Comprehensive performance testing for ProstCounter using Lighthouse and Puppeteer to analyze Core Web Vitals, layout shifting, and web performance issues.

## 🚀 Quick Start

```bash
# Install dependencies (if not already installed)
pnpm install

# Start the development server
pnpm dev

# Run all performance tests
pnpm perf:test
```

## 📊 Available Commands

| Command | Description |
|---------|-------------|
| `pnpm perf:test` | Run all performance tests (default) |
| `pnpm perf:public` | Run only public page tests |
| `pnpm perf:auth` | Run only authenticated flow tests |
| `pnpm perf:mobile` | Run only mobile performance tests |
| `pnpm perf:report` | Generate performance reports |
| `pnpm perf:watch` | Watch mode for development |

## 🎯 What Gets Tested

### Public Pages
- **Landing Page (/)** - App introduction and PWA features
- **Sign-in (/sign-in)** - Authentication performance
- **Sign-up (/sign-up)** - Registration flow performance

### Authenticated Pages & Flows
- **Home Dashboard (/home)** - Quick beer registration
- **Attendance Tracking (/attendance)** - Photo uploads and form performance
- **Groups Management (/groups)** - Group creation and leaderboards
- **Profile Settings (/profile)** - User account management
- **🎖️ Achievements (/achievements)** - Gamification system with progress bars and badges
- **Global Leaderboard (/leaderboard)** - Festival-scoped rankings

### User Flows
- **Quick Beer Registration** - Sign-in → Home → Register beer → Upload photo
- **Group Join Flow** - Join group → View leaderboard → Check gallery
- **Festival Switching** - Performance when switching between festivals
- **Achievement System** - Progress animations and badge rendering

### Mobile Performance
- **Different Devices** - iPhone SE, iPhone 12 Pro, Samsung Galaxy S21, iPad Mini
- **Network Conditions** - Slow 3G, Fast 3G, 4G
- **Touch Interactions** - Mobile-specific gestures and responsiveness
- **PWA Features** - Service worker, manifest, offline functionality

## 📈 Core Metrics Measured

### Core Web Vitals
- **LCP (Largest Contentful Paint)** - Loading performance
- **CLS (Cumulative Layout Shift)** - Layout stability (main focus)
- **FID/TBT (First Input Delay/Total Blocking Time)** - Interactivity

### Additional Metrics
- **FCP (First Contentful Paint)** - Initial rendering
- **Speed Index** - Visual completeness
- **TTI (Time to Interactive)** - Full interactivity
- **PWA Score** - Progressive Web App capabilities
- **Accessibility Score** - A11y compliance

## 🎯 Performance Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | < 2.5s | < 4s | ≥ 4s |
| CLS | < 0.1 | < 0.25 | ≥ 0.25 |
| TBT | < 200ms | < 600ms | ≥ 600ms |
| Lighthouse | ≥ 90 | ≥ 70 | < 70 |

## 📁 Test Structure

```
performance-tests/
├── config/
│   ├── lighthouse.config.js     # Lighthouse configuration
│   └── test-scenarios.ts        # Test scenarios and device configs
├── utils/
│   ├── auth-helper.ts          # Authentication utilities
│   ├── navigation.ts           # Page navigation helpers
│   └── reporter.ts             # Results formatting and reporting
├── tests/
│   ├── public-pages.ts         # Public page performance tests
│   ├── authenticated-flows.ts  # Authenticated user flow tests
│   └── mobile-performance.ts   # Mobile-specific performance tests
├── reports/                    # Generated reports directory
│   └── screenshots/           # Test screenshots
└── run-tests.ts               # Main test runner
```

## 🔧 Configuration

### Test User Credentials
The tests use seeded test users:
- **Email**: `user1@example.com`
- **Password**: `password`

### Device Configurations
- **Mobile**: iPhone viewports with 3G/4G throttling
- **Tablet**: iPad viewport
- **Desktop**: Standard desktop resolution

### Network Throttling
- **Slow 3G**: 500kbps, 400ms latency
- **Fast 3G**: 1.6Mbps, 150ms latency  
- **4G**: 9Mbps, 150ms latency

## 📊 Reports

After running tests, you'll get:

### HTML Report (`reports/performance-report-*.html`)
- Visual dashboard with Core Web Vitals
- Detailed test results table
- Pass/fail status for each test
- Color-coded metrics (🟢 Good, 🟡 Needs Improvement, 🔴 Poor)

### JSON Data (`reports/performance-data-*.json`)
- Raw performance data for CI/CD integration
- Structured metrics for analysis
- Test execution metadata

### Console Summary
```
🍻 PROSTCOUNTER PERFORMANCE TEST SUMMARY
========================================
📊 Tests Run: 24
✅ Passed: 22
❌ Failed: 2
📈 Success Rate: 92%

🎯 Core Web Vitals Averages:
   LCP: 2847ms 🟡
   CLS: 0.15 🟡  
   TBT: 234ms 🟢
```

## 🐛 Common Issues & Solutions

### Development Server Not Running
```bash
❌ Development server is not accessible at http://localhost:3000
   Please run: pnpm dev
```
**Solution**: Make sure `pnpm dev` is running before tests.

### Authentication Failures
```bash
❌ Authentication failed: user not authenticated
```
**Solution**: Ensure seed data exists (`user1@example.com` / `password`).

### Puppeteer Browser Issues
```bash
❌ Browser not initialized
```
**Solution**: Tests automatically handle browser lifecycle, but check system Chrome installation.

## 🎯 Focus Areas for Layout Shifting

The test suite specifically targets layout shift issues in:

1. **Achievement Progress Bars** - Animations causing CLS
2. **Image Loading** - Gallery photos without proper sizing
3. **Festival Switching** - Data loading causing content jumps
4. **Form Validation** - Error messages affecting layout
5. **Mobile Navigation** - Menu animations and transitions

## 🔄 CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Run Performance Tests
  run: |
    pnpm dev &
    sleep 10
    pnpm perf:test
    kill %1
```

## 🤝 Contributing

When adding new tests:

1. **Add test scenarios** in `config/test-scenarios.ts`
2. **Update expected metrics** based on performance requirements
3. **Add device configurations** for new testing targets
4. **Document new test cases** in this README

## 📚 Resources

- [Core Web Vitals](https://web.dev/vitals/)
- [Lighthouse Documentation](https://lighthouse-dev.appspot.com/)
- [Puppeteer API](https://pptr.dev/)
- [Performance Budgets](https://web.dev/performance-budgets-101/)