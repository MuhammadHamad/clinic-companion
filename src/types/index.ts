// User types
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'dentist' | 'receptionist';
  phone?: string;
  is_active: boolean;
  created_at: string;
}

// Patient types
export interface Patient {
  id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  allergies?: string;
  current_medications?: string;
  medical_conditions?: string;
  registration_date: string;
  last_visit_date?: string;
  notes?: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  created_by?: string;
  balance?: number;
  archived_at?: string;
}

// Appointment types
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type AppointmentType = 'Checkup' | 'Cleaning' | 'Filling' | 'Root Canal' | 'Extraction' | 'Crown' | 'Other';

export interface Appointment {
  id: string;
  patient_id: string;
  dentist_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  reason_for_visit?: string;
  notes?: string;
  created_at: string;
  patient?: Patient;
  dentist?: User;
}

// Treatment types
export interface TreatmentType {
  id: string;
  name: string;
  code?: string;
  default_price: number;
  duration_minutes: number;
  category: string;
  is_active: boolean;
}

// Invoice types
export type InvoiceStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'cheque';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  tooth_number?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  patient_id: string;
  visit_id?: string;
  is_void?: boolean;
  voided_at?: string;
  voided_reason?: string;
  voided_by?: string;
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: InvoiceStatus;
  payment_terms?: string;
  notes?: string;
  created_at: string;
  patient?: Patient;
  items?: InvoiceItem[];
}

export interface Payment {
  id: string;
  invoice_id: string;
  patient_id: string;
  visit_id?: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  visit_date: string;
  visit_number: number;
  created_at: string;
}

export type InvoiceAdjustmentType = 'credit' | 'debit';

export interface InvoiceAdjustment {
  id: string;
  invoice_id: string;
  patient_id: string;
  adjustment_date: string;
  type: InvoiceAdjustmentType;
  amount: number;
  reason?: string;
  created_at: string;
  created_by?: string;
}

// Inventory types
export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type MovementType = 'stock_in' | 'stock_out' | 'adjustment';

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
}

export interface InventoryItem {
  id: string;
  category_id?: string;
  item_name: string;
  item_code?: string;
  unit_of_measure: string;
  current_quantity: number;
  minimum_threshold: number;
  unit_cost?: number;
  supplier_name?: string;
  supplier_contact?: string;
  expiry_date?: string;
  status: InventoryStatus;
  created_at: string;
  category?: InventoryCategory;
}

export interface StockMovement {
  id: string;
  inventory_item_id: string;
  movement_type: MovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  unit_cost?: number;
  notes?: string;
  movement_date: string;
  created_at: string;
  created_by?: string;
  item?: InventoryItem;
}

// Dashboard types
export interface DashboardStats {
  today: {
    revenue: number;
    appointments_scheduled: number;
    appointments_completed: number;
    new_patients: number;
  };
  month: {
    revenue: number;
    outstanding: number;
    total_treatments: number;
  };
  year: {
    current_month: number;
    previous_month: number;
    ytd_revenue: number;
    monthly_trend: Array<{ month: string; revenue: number }>;
  };
  alerts: {
    low_stock_count: number;
    overdue_invoices_count: number;
  };
}

// Report types
export interface RevenueReport {
  total_revenue: number;
  total_patients: number;
  total_invoices: number;
  average_transaction: number;
  payment_breakdown: {
    method: PaymentMethod;
    amount: number;
    count: number;
  }[];
  treatment_breakdown: {
    type: string;
    revenue: number;
    count: number;
  }[];
}

export interface OutstandingReport {
  total_outstanding: number;
  aging: {
    range: string;
    amount: number;
    count: number;
  }[];
  patients: {
    patient: Patient;
    amount: number;
    days_overdue: number;
  }[];
}
