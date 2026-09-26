import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateInvoiceInput, Invoice, RecordPaymentInput, UpdateInvoiceInput } from "@clinic/shared";
import { api } from "../api/client.js";

interface InvoiceListResponse {
  items: Invoice[];
  page: number;
  pageSize: number;
  total: number;
}

// Billing writes need a live connection: totals and status are computed
// server-side, and staff are usually at the desk with wifi when billing.
// A failure here surfaces immediately instead of queuing silently — see
// docs/architecture.md "Known limitations".

export function useInvoicesList(patientId?: string, page = 1) {
  return useQuery({
    queryKey: ["invoices", "list", { patientId, page }],
    queryFn: () =>
      api.get<InvoiceListResponse>(
        `/api/invoices?page=${page}&pageSize=25${patientId ? `&patientId=${patientId}` : ""}`,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoices", "detail", id],
    queryFn: () => api.get<{ item: Invoice }>(`/api/invoices/${id}`).then((r) => r.item),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => api.post<{ item: Invoice }>("/api/invoices", input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["invoices", "list"] }),
  });
}

export function useUpdateInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInvoiceInput) => api.patch<{ item: Invoice }>(`/api/invoices/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices", "detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["invoices", "list"] });
    },
  });
}

export function useRecordPayment(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) =>
      api.post<{ item: Invoice }>(`/api/invoices/${invoiceId}/payments`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices", "detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices", "list"] });
    },
  });
}

/** Staff-side download - forces a save, matching every other file-download link in this app. */
export function invoicePdfUrl(id: string): string {
  return `${import.meta.env.VITE_API_URL as string}/api/invoices/${id}/pdf`;
}

/** No-auth, patient-facing link (opens inline) - only works with the exact invoice.shareToken. */
export function invoicePublicPdfUrl(id: string, shareToken: string): string {
  return `${import.meta.env.VITE_API_URL as string}/api/public/invoices/${id}/${shareToken}/pdf`;
}

// Admin-only (see routes/invoices.ts) - not exposed to doctor/front_desk in the UI.
export function useDeleteInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/api/invoices/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices", "detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["invoices", "list"] });
    },
  });
}

export function useDeletePayment(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) =>
      api.delete<{ item: Invoice }>(`/api/invoices/${invoiceId}/payments/${paymentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices", "detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices", "list"] });
    },
  });
}
