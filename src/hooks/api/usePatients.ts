import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Patient } from '@/types';
import { useToast } from '@/hooks';
import { useTenant } from '@/contexts/TenantContext';

type PatientsPageParams = {
  page: number;
  pageSize: number;
  searchQuery?: string;
  statusFilter?: string;
};

export function usePatients(options?: { autoFetch?: boolean }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const [pagedPatients, setPagedPatients] = useState<Patient[]>([]);
  const [pagedTotalCount, setPagedTotalCount] = useState<number>(0);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const { toast } = useToast();
  const { activeClinicId } = useTenant();

  const mapRowToPatient = (p: any): Patient => ({
    id: p.id,
    patient_number: p.patient_number,
    first_name: p.first_name,
    last_name: p.last_name,
    date_of_birth: p.date_of_birth,
    gender: p.gender as 'male' | 'female' | 'other' | undefined,
    phone: p.phone,
    email: p.email,
    address: p.address,
    city: p.city,
    emergency_contact_name: p.emergency_contact_name,
    emergency_contact_phone: p.emergency_contact_phone,
    allergies: p.allergies,
    current_medications: p.current_medications,
    medical_conditions: p.medical_conditions,
    registration_date: p.registration_date,
    last_visit_date: p.last_visit_date,
    notes: p.notes,
    status: p.status as 'active' | 'inactive',
    balance: p.balance ? Number(p.balance) : 0,
    created_at: p.created_at,
    created_by: p.created_by,
  });

  const fetchPatients = useCallback(async () => {
    try {
      const isInitialLoad = !hasLoadedOnceRef.current;
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      if (!activeClinicId) {
        setPatients([]);
        setLastUpdated(new Date());
        return;
      }

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', activeClinicId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPatients((data || []).map(mapRowToPatient));
      setLastUpdated(new Date());
      hasLoadedOnceRef.current = true;
    } catch (error: any) {
      logger.error('Error fetching patients:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch patients',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeClinicId, toast]);

  const fetchPatientsPage = useCallback(
    async ({ page, pageSize, searchQuery, statusFilter }: PatientsPageParams) => {
      try {
        setIsPageLoading(true);

        const safePage = Math.max(1, Number(page) || 1);
        const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));
        const from = (safePage - 1) * safePageSize;
        const to = from + safePageSize - 1;

        if (!activeClinicId) {
          setPagedPatients([]);
          setPagedTotalCount(0);
          return;
        }

        let query = supabase
          .from('patients')
          .select('*', { count: 'exact' })
          .eq('clinic_id', activeClinicId)
          .order('created_at', { ascending: false });

        const status = (statusFilter || 'all').trim();
        if (status === 'all') {
          query = query.neq('status', 'archived');
        } else {
          query = query.eq('status', status);
        }

        const qRaw = (searchQuery || '').trim();
        const q = qRaw.toLowerCase();
        const qDigits = q.replace(/\D/g, '');

        if (q.length > 0) {
          const like = `%${q}%`;
          const parts = [
            `first_name.ilike.${like}`,
            `last_name.ilike.${like}`,
            `patient_number.ilike.${like}`,
            `phone.ilike.${like}`,
          ];
          if (qDigits.length > 0 && qDigits !== q) {
            parts.push(`phone.ilike.%${qDigits}%`);
          }
          query = query.or(parts.join(','));
        }

        const { data, error, count } = await query.range(from, to);

        if (error) throw error;
        setPagedPatients((data || []).map(mapRowToPatient));
        setPagedTotalCount(count || 0);
      } catch (error: any) {
        logger.error('Error fetching patients page:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch patients',
          variant: 'destructive',
        });
      } finally {
        setIsPageLoading(false);
      }
    },
    [activeClinicId, toast],
  );

  const createPatient = async (patientData: Omit<Patient, 'id' | 'patient_number' | 'created_at' | 'registration_date'>) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const { data, error } = await supabase
        .from('patients')
        .insert({
          first_name: patientData.first_name,
          last_name: patientData.last_name,
          phone: patientData.phone,
          email: patientData.email || null,
          date_of_birth: patientData.date_of_birth || null,
          gender: patientData.gender || null,
          address: patientData.address || null,
          city: patientData.city || null,
          emergency_contact_name: patientData.emergency_contact_name || null,
          emergency_contact_phone: patientData.emergency_contact_phone || null,
          allergies: patientData.allergies || null,
          current_medications: patientData.current_medications || null,
          medical_conditions: patientData.medical_conditions || null,
          notes: patientData.notes || null,
          status: patientData.status || 'active',
          balance: patientData.balance || 0,
          created_by: sessionData.session?.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      setPatients((prev) => [mapRowToPatient(data), ...prev]);
      return { success: true, data };
    } catch (error: any) {
      logger.error('Error creating patient:', error);
      return { success: false, error: error.message };
    }
  };

  const updatePatient = async (id: string, patientData: Partial<Patient>) => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .update({
          first_name: patientData.first_name,
          last_name: patientData.last_name,
          phone: patientData.phone,
          email: patientData.email || null,
          date_of_birth: patientData.date_of_birth || null,
          gender: patientData.gender || null,
          address: patientData.address || null,
          city: patientData.city || null,
          emergency_contact_name: patientData.emergency_contact_name || null,
          emergency_contact_phone: patientData.emergency_contact_phone || null,
          allergies: patientData.allergies || null,
          current_medications: patientData.current_medications || null,
          medical_conditions: patientData.medical_conditions || null,
          notes: patientData.notes || null,
          status: patientData.status,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const updated = mapRowToPatient(data);

      setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setPagedPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return { success: true, data: updated };
    } catch (error: any) {
      logger.error('Error updating patient:', error);
      return { success: false, error: error.message };
    }
  };

  const archivePatient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('patients')
        .update({ 
          status: 'archived',
          archived_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setPatients((prev) => prev.map((p) => 
        p.id === id 
          ? { ...p, status: 'archived' as const, archived_at: new Date().toISOString() }
          : p
      ));
      return { success: true };
    } catch (error: any) {
      logger.error('Error archiving patient:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive patient',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }
  };

  const restorePatient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('patients')
        .update({ 
          status: 'active',
          archived_at: null
        })
        .eq('id', id);

      if (error) throw error;

      setPatients((prev) => prev.map((p) => 
        p.id === id 
          ? { ...p, status: 'active' as const, archived_at: undefined }
          : p
      ));
      return { success: true };
    } catch (error: any) {
      logger.error('Error restoring patient:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore patient',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    if (options?.autoFetch === false) return;
    fetchPatients();
  }, [fetchPatients, options?.autoFetch]);

  return {
    patients,
    isLoading,
    isRefreshing,
    lastUpdated,
    pagedPatients,
    pagedTotalCount,
    isPageLoading,
    fetchPatients,
    fetchPatientsPage,
    createPatient,
    updatePatient,
    archivePatient,
    restorePatient,
  };
}
