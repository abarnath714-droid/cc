export type UserRole = 'donor' | 'ngo' | 'admin';

export const FOOD_CATEGORIES = [
  'Cooked Meals',
  'Fresh Produce',
  'Bakery & Bread',
  'Packaged & Dry Goods',
  'Dairy & Beverages',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export interface User {
  id: number;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  organizationName: string | null;
  phone: string | null;
  address: string | null;
  status: 'active' | 'suspended' | string;
  isDemo: boolean;
  createdAt: string;
}

export interface Donation {
  id: number;
  donorId: number;
  donorName: string;
  donorOrganization: string | null;
  donorPhone: string | null;
  foodName: string;
  category: string;
  quantity: string;
  location: string;
  expiryDate: string;
  description: string;
  imageUrl?: string | null;
  status: 'Available' | 'Accepted' | 'Completed' | string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  pendingRequestCount: number;
}

export interface DonationRequest {
  id: number;
  donationId: number;
  ngoId: number;
  donorId: number;
  message: string;
  pickupTime: string;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Completed' | string;
  deliveryStage:
    | 'Pending'
    | 'Accepted'
    | 'Ready for Pickup'
    | 'In Transit'
    | 'Completed'
    | 'Rejected'
    | string;
  deliveryContact: string | null;
  trackingNote: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  foodName: string;
  category: string;
  quantity: string;
  location: string;
  expiryDate: string;
  donationStatus: string;
  ngoName: string;
  ngoOrganization: string | null;
  ngoEmail: string;
  ngoPhone: string | null;
  donorName: string;
  donorOrganization: string | null;
  donorPhone: string | null;
}

export interface ReceiverRequest {
  id: number;
  ngoId: number;
  donorId: number | null;
  foodName: string;
  category: string;
  quantityNeeded: string;
  deliveryAddress: string;
  neededByDate: string;
  urgency: 'Standard' | 'Urgent' | string;
  notes: string;
  imageUrl?: string | null;
  status: 'Open' | 'Pledged' | 'In Transit' | 'Delivered' | string;
  deliveryContact: string | null;
  trackingNote: string | null;
  pledgedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  ngoName: string;
  ngoOrganization: string | null;
  ngoEmail: string;
  ngoPhone: string | null;
  donorName: string | null;
  donorOrganization: string | null;
  donorPhone: string | null;
}

export interface PlatformStats {
  totalUsers: number;
  totalDonors: number;
  totalNgos: number;
  totalDonations: number;
  availableDonations: number;
  acceptedDonations: number;
  completedDonations: number;
  pendingRequests: number;
  totalRequests: number;
  openReceiverRequests?: number;
  totalReceiverRequests?: number;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}
