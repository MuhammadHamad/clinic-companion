import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Appointment, AppointmentStatus, AppointmentType, Patient } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAppointments = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(*)
        `)
        .order('appointment_date', { ascending: false });

      if (error) throw error;

      const mappedAppointments: Appointment[] = (data || []).map((a) => ({
        id: a.id,
        patient_id: a.patient_id,
        dentist_id: a.dentist_id,
        appointment_date: a.appointment_date,
        start_time: a.start_time,
        end_time: a.end_time,
        appointment_type: a.appointment_type as AppointmentType,
        status: a.status as AppointmentStatus,
        reason_for_visit: a.reason_for_visit,
        notes: a.notes,
        created_at: a.created_at,
        patient: a.patient ? {
          id: a.patient.id,
          patient_number: a.patient.patient_number,
          first_name: a.patient.first_name,
          last_name: a.patient.last_name,
          phone: a.patient.phone,
          email: a.patient.email,
          status: a.patient.status as 'active' | 'inactive',
          registration_date: a.patient.registration_date,
          created_at: a.patient.created_at,
        } as Patient : undefined,
      }));

      setAppointments(mappedAppointments);
    } catch (error: any) {
      console.error('Error fetching appointments:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch appointments',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createAppointment = async (appointmentData: {
    patient_id: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    appointment_type: AppointmentType;
    reason_for_visit?: string;
    notes?: string;
  }) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          patient_id: appointmentData.patient_id,
          dentist_id: userData.user?.id,
          appointment_date: appointmentData.appointment_date,
          start_time: appointmentData.start_time,
          end_time: appointmentData.end_time,
          appointment_type: appointmentData.appointment_type,
          status: 'scheduled',
          reason_for_visit: appointmentData.reason_for_visit || null,
          notes: appointmentData.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchAppointments();
      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      return { success: false, error: error.message };
    }
  };

  const updateAppointmentStatus = async (id: string, status: AppointmentStatus) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      await fetchAppointments();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return {
    appointments,
    isLoading,
    fetchAppointments,
    createAppointment,
    updateAppointmentStatus,
  };
}
