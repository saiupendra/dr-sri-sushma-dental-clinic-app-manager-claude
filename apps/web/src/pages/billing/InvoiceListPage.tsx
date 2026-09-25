import { useState } from "react";
import { Link } from "react-router-dom";
import { useInvoicesList } from "../../hooks/useInvoices.js";
import { formatDate } from "../../lib/dates.js";
import { Badge, Card, EmptyState, PageHeader, Button } from "../../components/ui.js";

export function InvoiceListPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useInvoicesList(undefined, page);

  return (
    <div>
      <PageHeader title="Billing" subtitle="Invoices across all patients. Open a patient's Billing tab to create one." />
      <Card>
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {!isLoading && data?.items.length === 0 && <EmptyState>No invoices yet.</EmptyState>}
        <ul className="divide-y divide-slate-100">
          {data?.items.map((invoice) => (
            <li key={invoice.id}>
              <Link to={`/billing/${invoice.id}`} className="flex items-center justify-between py-3 text-sm hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">₹{invoice.totalAmount.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(invoice.date)} · paid ₹{invoice.amountPaid.toFixed(2)}
                  </p>
                </div>
                <Badge tone={invoice.status === "paid" ? "green" : invoice.status === "cancelled" ? "red" : "amber"}>
                  {invoice.status.replace("_", " ")}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
        {!!data && data.total > data.pageSize && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>Page {data.page} of {Math.ceil(data.total / data.pageSize)}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= Math.ceil(data.total / data.pageSize)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
