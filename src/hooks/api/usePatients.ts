import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types';
import { useToast } from '@/hooks';

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
      setIsLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPatients((data || []).map(mapRowToPatient));
    } catch (error: any) {
      console.error('Error fetching patients:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch patients',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

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
      console.error('Error creating patient:', error);
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
      setPatients((prev) => prev.map((p) => (p.id === id ? mapRowToPatient(data) : p)));
      return { success: true };
    } catch (error: any) {
      console.error('Error updating patient:', error);
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
      console.error('Error archiving patient:', error);
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
      console.error('Error restoring patient:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore patient',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  return {
    patients,
    isLoading,
    fetchPatients,
    createPatient,
    updatePatient,
    archivePatient,
    restorePatient,
  };
}
