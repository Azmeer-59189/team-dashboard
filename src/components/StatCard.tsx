import { Icon, type IconName } from "./icons";

type Tone = "neutral" | "mint" | "sand" | "sky" | "blush" | "violet";

const DEFAULT_ICONS: Record<Tone, IconName> = {
  neutral: "list",
  mint: "check-circle",
  sand: "clock",
  sky: "loader",
  blush: "users",
  violet: "layers",
};

export default function StatCard({
  label,
  value,
  hero = false,
  trend,
  tone = "neutral",
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  hero?: boolean;
  trend?: { direction: "up" | "down"; label: string } | null;
  tone?: Tone;
  icon?: IconName;
  hint?: string;
}) {
  const trendPill = trend ? (
    <span className={`trend-pill ${trend.direction === "up" ? "trend-pill-up" : "trend-pill-down"}`}>
      {trend.direction === "up" ? "↑" : "↓"} {trend.label}
    </span>
  ) : null;

  if (hero) {
    return (
      <div className="stat-hero">
        <div className="relative z-10">
          <p className="stat-hero-label">{label}</p>
          <p className="stat-hero-value mt-2">{value}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
            {trendPill}
            {hint && <span>{hint}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`stat-secondary stat-tone-${tone}`}>
      <span className="stat-chip" aria-hidden="true">
        <Icon name={icon ?? DEFAULT_ICONS[tone]} size={18} />
      </span>
      <div className="min-w-0">
        <p className="stat-secondary-label">{label}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
          <p className="stat-secondary-value">{value}</p>
          {trendPill}
        </div>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
