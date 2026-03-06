

# Salary Insights: Replace Idealized Bell Curve with KDE (Kernel Density Estimation)

## Problem

The current bell curve assumes a **perfect normal distribution** — it takes the mean and standard deviation, then draws a symmetrical bell shape. This ignores where candidates' salaries actually cluster. If 3 candidates are at $800/mo and 1 is at $1,500/mo, the curve still shows a smooth symmetrical bell centered on the average, which misrepresents the real data.

## Solution

Replace `generateBellCurve` with a **Kernel Density Estimation (KDE)** function. KDE places a small Gaussian kernel at each actual salary data point and sums them. The result is a smooth curve that faithfully reflects where salaries cluster — showing bumps at common values and skew when data is lopsided. It keeps the same beautiful curvy aesthetic but is **data-accurate**.

## File: `src/components/jobs/SalaryInsightsCard.tsx`

### Replace `generateBellCurve` with `generateKDE`

```typescript
function generateKDE(salaries: number[], points = 60) {
  const min = Math.min(...salaries);
  const max = Math.max(...salaries);
  const range = max - min || 1;
  const bandwidth = range * 0.15 || 1; // Silverman-like bandwidth
  const padding = range * 0.2;
  const start = min - padding;
  const end = max + padding;
  const step = (end - start) / (points - 1);

  const data = [];
  for (let i = 0; i < points; i++) {
    const x = start + i * step;
    let density = 0;
    for (const s of salaries) {
      const z = (x - s) / bandwidth;
      density += Math.exp(-0.5 * z * z);
    }
    density /= salaries.length * bandwidth * Math.sqrt(2 * Math.PI);
    data.push({ salary: Math.round(x), density });
  }
  return data;
}
```

### Update `useMemo` block

Pass `displaySalaries` array directly into `generateKDE(displaySalaries)` instead of passing mean/stddev/min/max to `generateBellCurve`. Everything else (min, max, avg calculations, chart rendering, reference lines) stays identical.

## Result

Same smooth purple curve aesthetic, but now the shape reflects actual candidate salary clusters — multiple peaks when salaries group around different values, skew when data isn't symmetrical.

