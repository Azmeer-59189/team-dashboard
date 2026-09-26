export default function StatCard({
  label,
  value,
  hero = false,
  trend,
}: {
  label: string;
  value: string | number;
  hero?: boolean;
  trend?: { direction: "up" | "down"; label: string } | null;
}) {
  if (hero) {
    return (
      <div className="stat-hero">
        <p className="stat-hero-label">{label}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <p className="stat-hero-value">{value}</p>
          {trend && (
            <span className={`trend-pill ${trend.direction === "up" ? "trend-pill-up" : "trend-pill-down"}`}>
              {trend.direction === "up" ? "\u25B2" : "\u25BC"} {trend.label}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stat-secondary">
      <p className="stat-secondary-label">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="stat-secondary-value">{value}</p>
        {trend && (
          <span className={`trend-pill ${trend.direction === "up" ? "trend-pill-up" : "trend-pill-down"}`}>
            {trend.direction === "up" ? "\u25B2" : "\u25BC"} {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
