import { redirect } from "next/navigation";

import { BillingCutoffScreen } from "@/components/admin/BillingCutoffScreen";
import { getCurrentUserRole } from "@/lib/admin/members";
import {
  getBillingCutoffHistory,
  isNextMonthBillingConfirmed,
  nextMonthFirstDay,
  formatBillingMonth
} from "@/lib/admin/billing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "口座振替確定管理"
};

export default async function BillingCutoffPage() {
  const userContext = await getCurrentUserRole();
  if (!userContext) redirect("/login");
  if (userContext.role !== "admin") redirect("/");

  const [confirmed, history] = await Promise.all([
    isNextMonthBillingConfirmed(),
    getBillingCutoffHistory()
  ]);

  const nextMonth = nextMonthFirstDay();
  const nextMonthLabel = formatBillingMonth(nextMonth);

  return (
    <BillingCutoffScreen
      nextMonthLabel={nextMonthLabel}
      isConfirmed={confirmed}
      history={history}
    />
  );
}
