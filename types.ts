export interface RecordRow {
  id: string; // attendance record id
  slNo: number;
  pcNumber: string;
  rank: string;
  name: string | null;
  unit: string | null;
  mobile: string | null;
  status: string;
  presentAt: string | null;
  markedAt: string | null;
  distanceM: number | null;
  geofenceOk: boolean | null;
  dutyLocation: string | null;
  dutyRemarks: string | null;
  source: string;
}

export interface SummaryCounts {
  total: number;
  present: number;
  absent: number;
  off: number;
  available: number;
  duty: number;
  pending: number;
}
