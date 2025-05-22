import { Parser } from 'json2csv';

export function convertLogsToCSV(logs) {
  const fields = [
    { label: 'Nama User', value: 'nama_user' },
    { label: 'Action', value: 'action' },
    { label: 'Tabel', value: 'target_table' },
    { label: 'Target ID', value: 'target_id' },
    { label: 'IP Address', value: 'ip_address' },
    { label: 'User Agent', value: 'user_agent' },
    { label: 'Pesan', value: 'message' },
    { label: 'Waktu', value: (row) => new Date(row.created_at).toLocaleString() }
  ];

  const parser = new Parser({ fields });
  return parser.parse(logs);
}