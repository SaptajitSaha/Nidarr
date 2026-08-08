export type RiskLevel = 'Low' | 'Moderate' | 'Elevated' | 'High';
export type SourceType = 'Community' | 'News' | 'Infrastructure';

export interface SafetySignal {
  id: string;
  latitude: number;
  longitude: number;
  areaName: string;
  riskLevel: RiskLevel;
  sourceType: SourceType;
  reportCount: number;
  shortSummary: string;
  lastUpdated: string;
  isDemoData: true;
}

export const DEMO_SAFETY_SIGNALS: SafetySignal[] = [
  {
    id: 'sig-001',
    latitude: 22.5532,
    longitude: 88.3524,
    areaName: 'Park Street & Camac St Crossing',
    riskLevel: 'Elevated',
    sourceType: 'Community',
    reportCount: 14,
    shortSummary: 'Multiple reports of broken street lamps and verbal harassment near night venue exit.',
    lastUpdated: '15 mins ago',
    isDemoData: true,
  },
  {
    id: 'sig-002',
    latitude: 22.5835,
    longitude: 88.3426,
    areaName: 'Howrah Station South Exit',
    riskLevel: 'High',
    sourceType: 'News',
    reportCount: 28,
    shortSummary: 'Heavy crowd surge area with repeated pickpocketing and suspicious loitering alerts.',
    lastUpdated: '30 mins ago',
    isDemoData: true,
  },
  {
    id: 'sig-003',
    latitude: 22.5726,
    longitude: 88.4316,
    areaName: 'Salt Lake Sector V Tech Hub',
    riskLevel: 'Low',
    sourceType: 'Infrastructure',
    reportCount: 3,
    shortSummary: 'Active security patrol zone, bright LED street lighting, and clear CCTV coverage.',
    lastUpdated: '1 hour ago',
    isDemoData: true,
  },
  {
    id: 'sig-004',
    latitude: 22.5645,
    longitude: 88.3516,
    areaName: 'Esplanade Bus Stand & Metro Gate 2',
    riskLevel: 'Moderate',
    sourceType: 'Community',
    reportCount: 9,
    shortSummary: 'Overcrowded transit hub with complaints of catcalling during evening peak hours.',
    lastUpdated: '42 mins ago',
    isDemoData: true,
  },
  {
    id: 'sig-005',
    latitude: 22.5678,
    longitude: 88.3712,
    areaName: 'Sealdah Station Alleyway',
    riskLevel: 'Elevated',
    sourceType: 'Community',
    reportCount: 17,
    shortSummary: 'Dimly lit pedestrian shortcut with poor visibility and sparse police presence.',
    lastUpdated: '2 hours ago',
    isDemoData: true,
  },
  {
    id: 'sig-006',
    latitude: 22.4988,
    longitude: 88.3714,
    areaName: 'Jadavpur 8B Bus Terminus',
    riskLevel: 'Moderate',
    sourceType: 'Infrastructure',
    reportCount: 8,
    shortSummary: 'Damaged sidewalk lighting near auto stand causing visibility concerns after 10 PM.',
    lastUpdated: '3 hours ago',
    isDemoData: true,
  },
  {
    id: 'sig-007',
    latitude: 22.5441,
    longitude: 88.3468,
    areaName: 'Rabindra Sadan Exide Crossing',
    riskLevel: 'Low',
    sourceType: 'Infrastructure',
    reportCount: 2,
    shortSummary: 'Active traffic police guard booth and a monitored pedestrian subway crossing.',
    lastUpdated: '45 mins ago',
    isDemoData: true,
  },
];
