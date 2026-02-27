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
  const res = await http.post<Blob>('/api/invoices/pdf', payload, {
    responseType: 'blob',
  });

  const blob = res.data;
  const typed = blob.type ? blob : blob.slice(0, blob.size, 'application/pdf');

  try {
    const headerBytes = new Uint8Array(await typed.slice(0, 5).arrayBuffer());
    const header = String.fromCharCode(...Array.from(headerBytes));
    if (header !== '%PDF-') {
      const text = await typed.text();
      throw new Error(text || 'Response is not a valid PDF');
    }
  } catch (e) {
    throw e;
  }

  return typed;
}
