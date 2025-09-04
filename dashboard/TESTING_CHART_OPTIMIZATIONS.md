# Testing Chart Performance Optimizations

## 🚀 Quick Start Testing

### 1. Start the Development Server
```bash
npm run dev
```
Then visit: `http://localhost:3000/dashboard`

### 2. Navigate to Analytics Dashboard
- Go to any project dashboard: `/dashboard/projects/[projectId]/dashboard`
- The analytics charts are in the lower section of the page

## 🧪 Testing Each Optimization

### A. Data Sampling & Aggregation Testing

**Test with Mock Data:**
1. Open browser DevTools (F12) → Console
2. Paste this code to test the optimization functions:

```javascript
// Test the data optimization functions
const testLargeDataset = [];
for (let i = 0; i < 20; i++) {
  testLargeDataset.push({
    name: `Browser${i}`,
    value: Math.floor(Math.random() * 100),
    percentage: Math.random() * 10
  });
}

console.log('Original data points:', testLargeDataset.length);
// The charts should automatically limit to 8 items with "Others" grouping
```

**Expected Result:** Charts show max 8 items with "Others (X)" grouping for excess data

### B. Lazy Loading Testing

**Test Chart Lazy Loading:**
1. Open DevTools → Network tab
2. Reload the dashboard page
3. Scroll down slowly to the charts section
4. **Expected:** Charts only render when they come into view (100px before)

**Visual Test:**
1. Charts show skeleton loading states initially
2. Real charts appear as you scroll down
3. No performance lag during scrolling

### C. Memoization Testing

**Test Re-render Prevention:**
1. Open React DevTools extension
2. Go to Profiler tab
3. Start recording
4. Change time range dropdown (7d → 30d → 90d)
5. Stop recording

**Expected Result:** Only changed components re-render, memoized components stay unchanged

### D. Memory Usage Testing

**Test Memory Efficiency:**
1. Open DevTools → Performance tab
2. Start recording
3. Navigate between different time ranges multiple times
4. Force garbage collection
5. Stop recording

**Expected:** Memory usage remains stable, no memory leaks

## 🔧 Advanced Testing

### Performance Testing with Chrome DevTools

1. **Rendering Performance:**
```bash
# Open Chrome with performance flags
google-chrome --enable-precise-memory-info --enable-memory-benchmarking
```

2. **Lighthouse Audit:**
   - Open DevTools → Lighthouse
   - Run Performance audit
   - **Expected:** Score 90+ for Performance

3. **Core Web Vitals:**
   - LCP (Largest Contentful Paint): < 2.5s
   - FID (First Input Delay): < 100ms
   - CLS (Cumulative Layout Shift): < 0.1

### Load Testing with Large Datasets

**Simulate Large Data:**
1. Open DevTools → Console
2. Override the chart data temporarily:

```javascript
// Simulate 1000+ data points
const generateLargeDataset = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    name: `Item${i}`,
    value: Math.floor(Math.random() * 1000),
    percentage: Math.random() * 100
  }));
};

// Test with 1000 items
const largeData = generateLargeDataset(1000);
console.log('Testing with', largeData.length, 'items');
```

**Expected:** Charts handle 1000+ items smoothly with aggregation

## 📱 Mobile Testing

### Responsive Testing
1. Open DevTools → Toggle device toolbar
2. Test on various screen sizes:
   - Mobile: 375px width
   - Tablet: 768px width
   - Desktop: 1024px+ width

**Expected:** Charts adapt responsively, lazy loading works on touch scroll

### Touch Performance
- Test touch scrolling on mobile devices
- Charts should load smoothly as user scrolls

## 🔍 Code Quality Testing

### TypeScript Type Checking
```bash
npx tsc --noEmit
```
**Expected:** No type errors

### ESLint Code Quality
```bash
npm run lint
```
**Expected:** No critical errors, only minor unused variable warnings

### Build Optimization
```bash
npm run build
```
**Expected:** 
- Build succeeds in ~4 seconds
- Bundle size analysis shows reasonable chart component sizes
- No runtime errors

## 🎯 Specific Feature Testing

### 1. Chart Component Memoization
**Test:** Change unrelated dashboard data (like project selector)
**Expected:** Chart components don't re-render unnecessarily

### 2. Data Filtering
**Test:** Use browser data with many small-percentage items
**Expected:** Sub-0.5% items grouped into "Others"

### 3. Intersection Observer
**Test:** Charts outside viewport
**Expected:** Show skeleton placeholders until scrolled into view

### 4. Query Caching
**Test:** Switch between time ranges repeatedly
**Expected:** Data loads from cache, smooth transitions

## 🐛 Error Handling Testing

### Test Error States
1. **Network Error Simulation:**
   - DevTools → Network → Offline
   - Reload dashboard
   - **Expected:** Error state with retry button

2. **Empty Data Testing:**
   - Mock empty API responses
   - **Expected:** "No data available" messages

3. **Loading State Testing:**
   - Throttle network to Slow 3G
   - **Expected:** Skeleton loading states

## 📊 Performance Benchmarks

### Expected Performance Metrics:
- **Initial Render:** < 200ms for chart components
- **Data Processing:** < 50ms for 1000+ items
- **Scroll Performance:** 60fps maintained
- **Memory Usage:** < 50MB for dashboard
- **Bundle Size:** Analytics dashboard ~105KB

### Measurement Tools:
1. **React DevTools Profiler**
2. **Chrome Performance Tab**
3. **Lighthouse Performance Audit**
4. **WebPageTest.org**

## 🏁 Final Verification Checklist

- [ ] Charts render correctly with real data
- [ ] Lazy loading works on scroll
- [ ] Data aggregation limits items to 8 max
- [ ] Time range switching is smooth
- [ ] Mobile responsiveness works
- [ ] No console errors or warnings
- [ ] Memory usage remains stable
- [ ] Build completes successfully
- [ ] TypeScript types are correct
- [ ] Performance metrics meet targets

## 🚨 What to Look For (Potential Issues)

### Red Flags:
- ❌ Charts taking >2 seconds to render
- ❌ Memory usage continuously increasing
- ❌ Console errors about React hooks
- ❌ Charts not responding to data changes
- ❌ Lazy loading not triggering
- ❌ Mobile performance issues

### Green Signals:
- ✅ Smooth scrolling and interactions
- ✅ Charts load only when visible
- ✅ Data aggregation working
- ✅ Stable memory usage
- ✅ Fast time range switching
- ✅ Responsive design working

## 📞 Need Help?

If you encounter any issues:
1. Check browser console for errors
2. Verify React DevTools shows proper component structure
3. Test with different browsers (Chrome, Firefox, Safari)
4. Try on different devices/screen sizes
5. Check network performance in DevTools