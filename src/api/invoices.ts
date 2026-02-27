import http from './http';

export type PartyInfo = {
  name?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  phone?: string | null;
  email?: string | null;
  vatNumber?: string | null;
  attn?: string | null;
};

export type InvoiceLineItem = {
  description: string;
  total: number;
};

export type InvoiceTransaction = {
  transactionDate?: string | null;
  gateway?: string | null;
  transactionId?: string | null;
  amount: number;
};

export type InvoicePdfRequest = {
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  status?: string | null;
  currency?: string | null;
  vatRatePercent?: number | null;
  credit?: number | null;
  subTotal?: number | null;
  vatAmount?: number | null;
  total?: number | null;
  seller?: PartyInfo | null;
  billedTo?: PartyInfo | null;
  items?: InvoiceLineItem[] | null;
  transactions?: InvoiceTransaction[] | null;
  generatedOn?: string | null;
};

export async function generateInvoicePdf(payload: InvoicePdfRequest): Promise<Blob> {
  const res = await http.post<BlobPart>('/api/invoices/pdf', payload, {
    responseType: 'blob',
  });
  return new Blob([res.data], { type: 'application/pdf' });
}
