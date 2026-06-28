export type UserRole = 'doctor' | 'receptionist' | 'admin'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  display_name: string | null
  specialty: string | null
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_by: string | null
  created_from_ip: string | null
  created_from_device: string | null
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  full_name: string
  date_of_birth: string | null
  gender: 'male' | 'female' | 'other' | null
  mobile_number: string
  email: string | null
  address: string | null
  notes: string | null
  is_mobile_verified: boolean
  is_email_verified: boolean
  created_by: string | null
  registration_ip: string | null
  registration_lat: number | null
  registration_lng: number | null
  registration_location: string | null
  created_at: string
  updated_at: string
}

export type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: string
  doctor_id: string
  patient_id: string
  created_by: string
  appointment_date: string
  start_time: string
  end_time: string | null
  status: AppointmentStatus
  reason: string | null
  notes: string | null
  cancelled_reason: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export type PaymentStatus = 'pending' | 'paid' | 'waived'

export interface AppointmentPricing {
  id: string
  appointment_id: string
  doctor_id: string
  base_price: number
  discount_amount: number
  discount_reason: string | null
  net_amount: number
  payment_status: PaymentStatus
  paid_at: string | null
  currency: string
}

export interface Prescription {
  id: string
  prescription_number: string
  appointment_id: string | null
  patient_file_id: string | null
  doctor_id: string
  patient_id: string
  diagnosis_note: string | null
  notes: string | null
  valid_until: string | null
  is_printed: boolean
  printed_at: string | null
  printed_by: string | null
  storage_path: string | null
  created_at: string
  updated_at: string
}

export interface PrescriptionItem {
  id: string
  prescription_id: string
  medication_name: string
  dosage: string | null
  frequency: string | null
  duration: string | null
  route: string | null
  notes: string | null
  sort_order: number
}

export interface ReceptionistDoctorAssignment {
  id: string
  receptionist_id: string
  doctor_id: string
  assigned_by: string
  is_active: boolean
  created_at: string
}
