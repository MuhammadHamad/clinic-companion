import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InventoryItem, InventoryCategory, InventoryStatus, MovementType } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('*')
        .order('name');

      if (error) throw error;

      setCategories((data || []).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })));
    } catch (error: any) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          category:inventory_categories(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedItems: InventoryItem[] = (data || []).map((item) => ({
        id: item.id,
        category_id: item.category_id,
        item_name: item.item_name,
        item_code: item.item_code,
        unit_of_measure: item.unit_of_measure,
        current_quantity: item.current_quantity,
        minimum_threshold: item.minimum_threshold,
        unit_cost: item.unit_cost ? Number(item.unit_cost) : undefined,
        supplier_name: item.supplier_name,
        supplier_contact: item.supplier_contact,
        expiry_date: item.expiry_date,
        status: item.status as InventoryStatus,
        created_at: item.created_at,
        category: item.category ? {
          id: item.category.id,
          name: item.category.name,
          description: item.category.description,
        } : undefined,
      }));

      setItems(mappedItems);
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch inventory',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createItem = async (itemData: Omit<InventoryItem, 'id' | 'status' | 'created_at' | 'category'>) => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          item_name: itemData.item_name,
          item_code: itemData.item_code || null,
          category_id: itemData.category_id || null,
          unit_of_measure: itemData.unit_of_measure,
          current_quantity: itemData.current_quantity,
          minimum_threshold: itemData.minimum_threshold,
          unit_cost: itemData.unit_cost || null,
          supplier_name: itemData.supplier_name || null,
          supplier_contact: itemData.supplier_contact || null,
          expiry_date: itemData.expiry_date || null,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchItems();
      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating item:', error);
      return { success: false, error: error.message };
    }
  };

  const updateItem = async (id: string, itemData: Partial<InventoryItem>) => {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({
          item_name: itemData.item_name,
          item_code: itemData.item_code || null,
          category_id: itemData.category_id || null,
          unit_of_measure: itemData.unit_of_measure,
          current_quantity: itemData.current_quantity,
          minimum_threshold: itemData.minimum_threshold,
          unit_cost: itemData.unit_cost || null,
          supplier_name: itemData.supplier_name || null,
          supplier_contact: itemData.supplier_contact || null,
          expiry_date: itemData.expiry_date || null,
        })
        .eq('id', id);

      if (error) throw error;

      await fetchItems();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating item:', error);
      return { success: false, error: error.message };
    }
  };

  const recordMovement = async (itemId: string, movementData: {
    movement_type: MovementType;
    quantity: number;
    unit_cost?: number;
    notes?: string;
  }) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) throw new Error('Item not found');

      let newQuantity = item.current_quantity;
      
      switch (movementData.movement_type) {
        case 'stock_in':
          newQuantity += movementData.quantity;
          break;
        case 'stock_out':
          newQuantity -= movementData.quantity;
          if (newQuantity < 0) {
            throw new Error('Cannot remove more than available quantity');
          }
          break;
        case 'adjustment':
          newQuantity = movementData.quantity;
          break;
      }

      const { data: userData } = await supabase.auth.getUser();

      // Record movement
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          inventory_item_id: itemId,
          movement_type: movementData.movement_type,
          quantity: movementData.quantity,
          previous_quantity: item.current_quantity,
          new_quantity: newQuantity,
          unit_cost: movementData.unit_cost || null,
          notes: movementData.notes || null,
          created_by: userData.user?.id,
        });

      if (movementError) throw movementError;

      // Update item quantity (status will be auto-updated by trigger)
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          current_quantity: newQuantity,
          unit_cost: movementData.unit_cost || item.unit_cost,
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      await fetchItems();
      return { success: true };
    } catch (error: any) {
      console.error('Error recording movement:', error);
      return { success: false, error: error.message };
    }
  };

  const createCategory = async (name: string, description?: string) => {
    try {
      const { data, error } = await supabase
        .from('inventory_categories')
        .insert({ name, description: description || null })
        .select()
        .single();

      if (error) throw error;

      await fetchCategories();
      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating category:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, [fetchItems, fetchCategories]);

  return {
    items,
    categories,
    isLoading,
    fetchItems,
    fetchCategories,
    createItem,
    updateItem,
    recordMovement,
    createCategory,
  };
}
