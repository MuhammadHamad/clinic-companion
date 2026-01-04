import { z } from 'zod';

// Patient form validation schema
export const patientSchema = z.object({
  first_name: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  last_name: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  phone: z.string()
    .min(1, 'Phone number is required')
    .regex(/^[\d\s\-\+\(\)]+$/, 'Please enter a valid phone number')
    .min(10, 'Phone number must be at least 10 digits'),
  email: z.string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
  date_of_birth: z.string()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const dob = new Date(date);
      const today = new Date();
      return dob < today;
    }, 'Date of birth must be in the past'),
  address: z.string()
    .max(200, 'Address must be less than 200 characters')
    .optional()
    .or(z.literal('')),
  city: z.string()
    .max(100, 'City must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  gender: z.enum(['male', 'female', 'other'])
    .optional()
    .or(z.literal('')),
  patient_number: z.string()
    .max(20, 'Patient number must be less than 20 characters')
    .optional()
    .or(z.literal('')),
  emergency_contact_name: z.string()
    .max(100, 'Emergency contact name must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  emergency_contact_phone: z.string()
    .regex(/^[\d\s\-\+\(\)]*$/, 'Please enter a valid emergency contact phone number')
    .optional()
    .or(z.literal('')),
  allergies: z.string()
    .max(500, 'Allergies must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  current_medications: z.string()
    .max(500, 'Current medications must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  medical_conditions: z.string()
    .max(500, 'Medical conditions must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional()
    .or(z.literal('')),
});

// Invoice form validation schema
export const invoiceSchema = z.object({
  patient_id: z.string()
    .min(1, 'Patient is required'),
  items: z.array(z.object({
    description: z.string()
      .min(1, 'Description is required')
      .max(200, 'Description must be less than 200 characters'),
    quantity: z.number()
      .min(1, 'Quantity must be at least 1')
      .max(9999, 'Quantity must be less than 10000'),
    unit_price: z.number()
      .min(0, 'Unit price must be positive')
      .max(999999, 'Unit price must be less than 1,000,000'),
  }))
    .min(1, 'At least one item is required')
    .max(50, 'Cannot have more than 50 items'),
  discount_amount: z.number()
    .min(0, 'Discount amount must be positive')
    .max(999999, 'Discount amount must be less than 1,000,000'),
  tax_amount: z.number()
    .min(0, 'Tax amount must be positive')
    .max(999999, 'Tax amount must be less than 1,000,000'),
  payment_terms: z.string()
    .max(100, 'Payment terms must be less than 100 characters')
    .optional(),
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),
});

// Payment form validation schema
export const paymentSchema = z.object({
  amount: z.number()
    .min(0.01, 'Amount must be greater than 0')
    .max(999999, 'Amount must be less than 1,000,000'),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'other'])
    .refine((val) => val !== undefined, 'Payment method is required'),
  payment_date: z.string()
    .min(1, 'Payment date is required')
    .refine((date) => {
      const payment = new Date(date);
      const today = new Date();
      return payment <= today;
    }, 'Payment date cannot be in the future'),
  notes: z.string()
    .max(200, 'Notes must be less than 200 characters')
    .optional()
    .or(z.literal('')),
});

// Inventory item form validation schema
export const inventoryItemSchema = z.object({
  item_name: z.string()
    .min(1, 'Item name is required')
    .max(100, 'Item name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Item name can only contain letters, numbers, spaces, hyphens, and underscores'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  unit_of_measure: z.string()
    .min(1, 'Unit of measure is required')
    .max(20, 'Unit of measure must be less than 20 characters'),
  category_id: z.string()
    .min(1, 'Category is required'),
  current_stock: z.number()
    .min(0, 'Current stock cannot be negative')
    .max(999999, 'Current stock must be less than 1,000,000')
    .optional(),
  minimum_stock: z.number()
    .min(0, 'Minimum stock cannot be negative')
    .max(999999, 'Minimum stock must be less than 1,000,000')
    .optional(),
  unit_cost: z.number()
    .min(0, 'Unit cost cannot be negative')
    .max(999999, 'Unit cost must be less than 1,000,000')
    .optional(),
  item_code: z.string()
    .max(50, 'Item code must be less than 50 characters')
    .optional()
    .or(z.literal('')),
});

// Appointment form validation schema
export const appointmentSchema = z.object({
  patient_id: z.string()
    .min(1, 'Patient is required'),
  appointment_date: z.string()
    .min(1, 'Appointment date is required')
    .refine((date) => {
      const appointment = new Date(date);
      const today = new Date();
      return appointment >= today;
    }, 'Appointment date cannot be in the past'),
  start_time: z.string()
    .min(1, 'Start time is required')
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time (HH:MM)'),
  end_time: z.string()
    .min(1, 'End time is required')
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time (HH:MM)'),
  appointment_type: z.enum(['checkup', 'treatment', 'consultation', 'followup', 'emergency'])
    .refine((val) => val !== undefined, 'Appointment type is required'),
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  dentist_id: z.string()
    .optional()
    .or(z.literal('')),
}).refine((data) => {
  if (data.start_time && data.end_time) {
    const start = new Date(`2000-01-01T${data.start_time}`);
    const end = new Date(`2000-01-01T${data.end_time}`);
    return end > start;
  }
  return true;
}, 'End time must be after start time');

// Stock movement form validation schema
export const stockMovementSchema = z.object({
  inventory_item_id: z.string()
    .min(1, 'Inventory item is required'),
  movement_type: z.enum(['in', 'out'])
    .refine((val) => val !== undefined, 'Movement type is required'),
  quantity: z.number()
    .min(1, 'Quantity must be at least 1')
    .max(999999, 'Quantity must be less than 1,000,000'),
  notes: z.string()
    .max(200, 'Notes must be less than 200 characters')
    .optional()
    .or(z.literal('')),
  reference_number: z.string()
    .max(50, 'Reference number must be less than 50 characters')
    .optional()
    .or(z.literal('')),
});

// Clinic/SaaS form validation schema
export const clinicSchema = z.object({
  name: z.string()
    .min(1, 'Clinic name is required')
    .max(100, 'Clinic name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_&]+$/, 'Clinic name can only contain letters, numbers, spaces, hyphens, underscores, and ampersands'),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9\-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  address: z.string()
    .max(200, 'Address must be less than 200 characters')
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .regex(/^[+]?[\d\s()-]+$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
  email: z.string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
});

// User profile update schema
export const userProfileSchema = z.object({
  first_name: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s-']+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  last_name: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s-']+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
});

// Authentication schemas
export const loginSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address'),
  password: z.string()
    .min(1, 'Password is required'),
});

export const signUpSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be less than 100 characters'),
});

export const resetPasswordSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address'),
});

export const newPasswordSchema = z.object({
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be less than 100 characters'),
  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Type exports for use in components
export type PatientFormData = z.infer<typeof patientSchema>;
export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type PaymentFormData = z.infer<typeof paymentSchema>;
export type InventoryItemFormData = z.infer<typeof inventoryItemSchema>;
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
export type StockMovementFormData = z.infer<typeof stockMovementSchema>;
export type ClinicFormData = z.infer<typeof clinicSchema>;
export type UserProfileFormData = z.infer<typeof userProfileSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type NewPasswordFormData = z.infer<typeof newPasswordSchema>;
