import { useState } from "react";
import { Link } from "react-router-dom";
import type { Invoice } from "@clinic/shared";
import { useDeleteInvoice, useInvoicesList } from "../../hooks/useInvoices.js";
import { useAuth } from "../../auth/useAuth.js";
import { formatDateTime } from "../../lib/dates.js";
import { ApiError } from "../../api/client.js";
import { Badge, Button, Card, EmptyState, FieldError, PageHeader } from "../../components/ui.js";

function InvoiceRow({ invoice, canDelete }: { invoice: Invoice; canDelete: boolean }) {
  const deleteInvoice = useDeleteInvoice(invoice.id);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDelete() {
    setDeleteError(null);
    if (!confirm("Delete this invoice? This can't be undone.")) return;
    try {
      await deleteInvoice.mutateAsync();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete the invoice.");
    }
  }

  return (
    <li className="py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <Link to={`/billing/${invoice.id}`} className="flex-1 hover:underline">
          <p className="font-medium text-slate-900">₹{invoice.totalAmount.toFixed(2)}</p>
          <p className="text-xs text-slate-400">
            {formatDateTime(invoice.date)} · paid ₹{invoice.amountPaid.toFixed(2)}
          </p>
        </Link>
        <Badge tone={invoice.status === "paid" ? "green" : invoice.status === "cancelled" ? "red" : "amber"}>
          {invoice.status.replace("_", " ")}
        </Badge>
        {canDelete && (
          <Button size="sm" variant="danger" onClick={() => void onDelete()} disabled={deleteInvoice.isPending}>
            Delete
          </Button>
        )}
      </div>
      <FieldError>{deleteError}</FieldError>
    </li>
  );
}

export function InvoiceListPage() {
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const { data, isLoading } = useInvoicesList(undefined, page);
  const isAdmin = user?.role === "admin";

  return (
    <div>
      <PageHeader title="Billing" subtitle="Invoices across all patients. Open a patient's Billing tab to create one." />
      <Card>
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {!isLoading && data?.items.length === 0 && <EmptyState>No invoices yet.</EmptyState>}
        <ul className="divide-y divide-slate-100">
          {data?.items.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} canDelete={isAdmin} />
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
