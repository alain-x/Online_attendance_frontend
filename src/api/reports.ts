import http from './http';

export async function downloadDailyAttendanceCsv(date?: string): Promise<void> {
  const params: { date?: string } = {};
  if (date) params.date = date;

  const res = await http.get<BlobPart>('/api/reports/daily-attendance.csv', {
    params,
    responseType: 'blob',
  });

  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const safeDate = date || new Date().toISOString().slice(0, 10);
  a.download = `daily_attendance_${safeDate}.csv`;

  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

