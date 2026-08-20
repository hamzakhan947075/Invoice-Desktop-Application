export function RevenueChart({
  data,
  currency,
}: {
  data: { label: string; amount: number }[];
  currency: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.amount));

  return (
    <div className="flex items-end gap-3 pt-4">
      {data.map((point) => (
        <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {point.amount > 0 ? `${currency} ${Math.round(point.amount).toLocaleString()}` : ""}
          </span>
          <div
            className="w-full rounded-t-sm bg-primary/80"
            style={{ height: `${Math.max(4, (point.amount / max) * 140)}px` }}
          />
          <span className="text-xs text-muted-foreground">{point.label}</span>
        </div>
      ))}
    </div>
  );
}
