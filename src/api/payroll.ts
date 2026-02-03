import http from './http';

import type { PayrollSummaryResponse } from './types';

export async function getPayrollSummary(from: string, to: string): Promise<PayrollSummaryResponse> {
  const res = await http.get<PayrollSummaryResponse>('/api/payroll/summary', {
    params: { from, to },
  });
  return res.data;
}
