import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { TreatmentType } from '@/types';
import { useToast } from '@/hooks';

export function useTreatmentTypes() {
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTreatmentTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('treatment_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const mappedTypes: TreatmentType[] = (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        default_price: Number(t.default_price),
        duration_minutes: t.duration_minutes,
        category: t.category,
        is_active: t.is_active,
      }));

      setTreatmentTypes(mappedTypes);
    } catch (error: any) {
      logger.error('Error fetching treatment types:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch treatment types',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createTreatmentType = async (typeData: Omit<TreatmentType, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('treatment_types')
        .insert({
          name: typeData.name,
          code: typeData.code || null,
          default_price: typeData.default_price,
          duration_minutes: typeData.duration_minutes,
          category: typeData.category || null,
          is_active: typeData.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchTreatmentTypes();
      return { success: true, data };
    } catch (error: any) {
      logger.error('Error creating treatment type:', error);
      return { success: false, error: error.message };
    }
  };

  const updateTreatmentType = async (id: string, typeData: Partial<Omit<TreatmentType, 'id'>>) => {
    try {
      const { data, error } = await supabase
        .from('treatment_types')
        .update({
          name: typeData.name,
          code: typeData.code || null,
          default_price: typeData.default_price,
          duration_minutes: typeData.duration_minutes,
          category: typeData.category || null,
          is_active: typeData.is_active,
        })
        .eq('id', id)
        .select('id');

      if (error) throw error;

      if (!data || data.length === 0) {
        return { success: false, error: 'Not authorized to update this service (or it no longer exists).' };
      }

      await fetchTreatmentTypes();
      return { success: true, data };
    } catch (error: any) {
      logger.error('Error updating treatment type:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteTreatmentType = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('treatment_types')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw error;

      if (!data || data.length === 0) {
        return { success: false, error: 'Not authorized to delete this service (or it no longer exists).' };
      }

      await fetchTreatmentTypes();
      return { success: true };
    } catch (error: any) {
      logger.error('Error deleting treatment type:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchTreatmentTypes();
  }, [fetchTreatmentTypes]);

  return {
    treatmentTypes,
    isLoading,
    fetchTreatmentTypes,
    createTreatmentType,
    updateTreatmentType,
    deleteTreatmentType,
  };
}
