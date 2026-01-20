import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Appointment, AppointmentStatus, AppointmentType, Patient } from '@/types';
import { useToast } from '@/hooks';
import { useTenant } from '@/contexts/TenantContext';

const buildAppointmentTypeCandidates = (raw: string): string[] => {
  const v = String(raw || '').trim();
  if (!v) return [];
  return [v];
};

const toHHMM = (value: unknown) => {
  const s = String(value || '').trim();
  if (!s) return s;
  const parts = s.split(':');
  if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  return s;
};

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentTypeValues, setAppointmentTypeValues] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeClinicId } = useTenant();

  const fetchAppointments = useCallback(async () => {
    try {
      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      if (!activeClinicId) {
        setAppointments([]);
        return;
      }

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(*)
        `)
        .eq('clinic_id', activeClinicId)
        .order('appointment_date', { ascending: false });

      if (error) throw error;

      const mappedAppointments: Appointment[] = (data || []).map((a) => ({
        id: a.id,
        patient_id: a.patient_id,
        dentist_id: a.dentist_id,
        appointment_date: a.appointment_date,
        start_time: toHHMM(a.start_time),
        end_time: toHHMM(a.end_time),
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

      const typeSet = new Set<string>();
      for (const row of data || []) {
        const t = String((row as any)?.appointment_type || '').trim();
        if (t) typeSet.add(t);
      }
      setAppointmentTypeValues(Array.from(typeSet).sort((a, b) => a.localeCompare(b)));
    } catch (error: any) {
      logger.error('Error fetching appointments:', error);
      toast({
        title: 'Error',
        description: error?.message ? `Failed to fetch appointments: ${error.message}` : 'Failed to fetch appointments',
        variant: 'destructive',
      });
    } finally {
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        setIsLoading(false);
      }
      setIsRefreshing(false);
    }
  }, [activeClinicId, toast]);

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
      if (!activeClinicId) {
        return { success: false, error: 'No active clinic selected' };
      }

      const startDateTime = new Date(`${appointmentData.appointment_date}T${appointmentData.start_time}:00`);
      if (!(startDateTime.getTime() > Date.now())) {
        return { success: false, error: 'Cannot schedule an appointment in the past' };
      }

      const { data: userData } = await supabase.auth.getUser();
      
      const candidates = buildAppointmentTypeCandidates(String(appointmentData.appointment_type || ''));
      if (candidates.length === 0) {
        return { success: false, error: 'Appointment type is required' };
      }

      const tempId = `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const optimistic: Appointment = {
        id: tempId,
        patient_id: appointmentData.patient_id,
        dentist_id: userData.user?.id || '',
        appointment_date: appointmentData.appointment_date,
        start_time: toHHMM(appointmentData.start_time),
        end_time: toHHMM(appointmentData.end_time),
        appointment_type: appointmentData.appointment_type,
        status: 'scheduled',
        reason_for_visit: appointmentData.reason_for_visit,
        notes: appointmentData.notes,
        created_at: new Date().toISOString(),
        patient: undefined,
      };

      setAppointments((prev) => {
        if (prev.some((a) => a.id === optimistic.id)) return prev;
        return [optimistic, ...prev];
      });

      let lastError: any = null;
      let inserted: any = null;

      for (const candidate of candidates) {
        const { data, error } = await supabase
          .from('appointments')
          .insert({
            clinic_id: activeClinicId,
            patient_id: appointmentData.patient_id,
            dentist_id: userData.user?.id,
            appointment_date: appointmentData.appointment_date,
            start_time: appointmentData.start_time,
            end_time: appointmentData.end_time,
            appointment_type: candidate,
            status: 'scheduled',
            reason_for_visit: appointmentData.reason_for_visit || null,
            notes: appointmentData.notes || null,
          })
          .select()
          .single();

        if (!error) {
          inserted = data;
          lastError = null;
          break;
        }

        lastError = error;
        break;
      }

      if (lastError) throw lastError;

      if (inserted) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === tempId
              ? {
                  ...a,
                  id: inserted.id || a.id,
                  dentist_id: inserted.dentist_id || a.dentist_id,
                  appointment_date: inserted.appointment_date || a.appointment_date,
                  start_time: toHHMM(inserted.start_time || a.start_time),
                  end_time: toHHMM(inserted.end_time || a.end_time),
                  appointment_type: (inserted.appointment_type as AppointmentType) || a.appointment_type,
                  status: (inserted.status as AppointmentStatus) || a.status,
                  reason_for_visit: inserted.reason_for_visit ?? a.reason_for_visit,
                  notes: inserted.notes ?? a.notes,
                  created_at: inserted.created_at || a.created_at,
                }
              : a,
          ),
        );

        setAppointmentTypeValues((prev) => {
          const next = new Set(prev);
          const t = String((inserted.appointment_type as AppointmentType) || appointmentData.appointment_type || '').trim();
          if (t) next.add(t);
          return Array.from(next).sort((a, b) => a.localeCompare(b));
        });
      }

      await fetchAppointments();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      return { success: true, data: inserted };
    } catch (error: any) {
      logger.error('Error creating appointment:', error);
      setAppointments((prev) => prev.filter((a) => !a.id.startsWith('temp_')));
      return { success: false, error: error.message };
    }
  };

  const updateAppointmentStatus = async (id: string, status: AppointmentStatus) => {
    try {
      let prevStatus: AppointmentStatus | null = null;
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          prevStatus = a.status;
          return { ...a, status };
        }),
      );

      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) {
        if (prevStatus) {
          setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: prevStatus as AppointmentStatus } : a)));
        }
        throw error;
      }

      await fetchAppointments();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      return { success: true };
    } catch (error: any) {
      logger.error('Error updating appointment:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return {
    appointments,
    appointmentTypeValues,
    isLoading,
    isRefreshing,
    fetchAppointments,
    createAppointment,
    updateAppointmentStatus,
  };
}
