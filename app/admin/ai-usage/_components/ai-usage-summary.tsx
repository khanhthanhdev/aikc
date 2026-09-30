import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/admin/ui/card";
import { getAiUsageSummary } from "../_lib/queries";

export const AiUsageSummary = async () => {
  const { total, today, visitors, cacheHitRate, failed } =
    await getAiUsageSummary();

  const cards = [
    { label: "Total questions", value: total.toLocaleString() },
    { label: "Today", value: today.toLocaleString() },
    { label: "Distinct visitors", value: visitors.toLocaleString() },
    {
      label: "Cache hit rate",
      value: cacheHitRate === null ? "—" : `${Math.round(cacheHitRate * 100)}%`,
    },
    { label: "Failed answers", value: failed.toLocaleString() },
  ];

  return (
    <>
      {cards.map(({ label, value }) => (
        <Card key={label}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-3xl">{value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </>
  );
};
