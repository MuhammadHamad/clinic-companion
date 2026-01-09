import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InventoryItem, InventoryCategory, InventoryStatus, MovementType, StockMovement } from '@/types';
import { useToast } from '@/hooks';

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const generateItemCode = () => {
    try {
      const uuid = (globalThis as any).crypto?.randomUUID?.();
      if (uuid) return `ITM-${uuid}`;
    } catch {
      // ignore
    }
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const ts = Date.now().toString(36).toUpperCase();
    return `ITM-${ts}-${rand}`;
  };

  const mapRowToItem = (item: any): InventoryItem => ({
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
    category: item.category
      ? {
          id: item.category.id,
          name: item.category.name,
          description: item.category.description,
        }
      : undefined,
  });

  const seedDefaultCategories = async () => {
    // Skip auto-seeding for now due to global unique constraint issue
    // Users will create categories manually as needed
    console.log('Auto-seeding disabled due to global unique constraint. Users will create categories manually.');
    return;
    
    /* Original seeding code disabled for now
    const defaultCategories = [
      { name: 'Instruments', description: 'Dental instruments and tools' },
      { name: 'Materials', description: 'Dental materials and supplies' },
      { name: 'Consumables', description: 'Single-use consumable items' },
      { name: 'Medications', description: 'Pharmaceutical products and medications' },
      { name: 'Equipment', description: 'Dental equipment and devices' },
    ];

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) return;

      // Get user's clinic_id
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('clinic_id')
        .eq('user_id', sessionData.session.user.id)
        .single();

      if (!userRole?.clinic_id) return;

      // Check if categories already exist for this clinic
      const { data: existingCategories } = await supabase
        .from('inventory_categories')
        .select('name')
        .eq('clinic_id', userRole.clinic_id);

      const existingNames = existingCategories?.map(c => c.name) || [];
      
      // Only insert categories that don't already exist
      const categoriesToInsert = defaultCategories.filter(
        cat => !existingNames.includes(cat.name)
      );

      if (categoriesToInsert.length === 0) {
        console.log('Default categories already exist for clinic');
        return;
      }

      // Insert missing default categories
      const { error } = await supabase
        .from('inventory_categories')
        .insert(
          categoriesToInsert.map(cat => ({
            ...cat,
            clinic_id: userRole.clinic_id,
          }))
        );

      if (error) {
        console.error('Error seeding default categories:', error);
      } else {
        console.log(`Seeded ${categoriesToInsert.length} default categories`);
      }
    } catch (error) {
      console.error('Error seeding default categories:', error);
    }
    */
  };

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('*')
        .order('name');

      if (error) throw error;

      const categories = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
      }));

      setCategories(categories);
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

      setItems((data || []).map(mapRowToItem));
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

  const mapRowToMovement = (m: any): StockMovement => ({
    id: m.id,
    inventory_item_id: m.inventory_item_id,
    movement_type: m.movement_type as MovementType,
    quantity: Number(m.quantity),
    previous_quantity: Number(m.previous_quantity),
    new_quantity: Number(m.new_quantity),
    unit_cost: m.unit_cost != null ? Number(m.unit_cost) : undefined,
    notes: m.notes ?? undefined,
    movement_date: m.movement_date || m.created_at?.split('T')[0] || '',
    created_at: m.created_at,
    created_by: m.created_by ?? undefined,
    item: m.item ? mapRowToItem(m.item) : undefined,
  });

  const fetchMovements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          item:inventory_items(
            *,
            category:inventory_categories(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements((data || []).map(mapRowToMovement));
    } catch (error: any) {
      console.error('Error fetching stock movements:', error);
    }
  }, []);

  const createItem = async (itemData: Omit<InventoryItem, 'id' | 'status' | 'created_at' | 'category' | 'item_code'>) => {
    try {
      const isLikelyAutoCode = (code?: string | null) => (code || '').trim().toUpperCase().startsWith('ITM-');
      const tryInsert = async (itemCode: string | null) => {
        return supabase
          .from('inventory_items')
          .insert({
            item_name: itemData.item_name,
            item_code: itemCode,
            category_id: itemData.category_id || null,
            unit_of_measure: itemData.unit_of_measure,
            current_quantity: itemData.current_quantity,
            minimum_threshold: itemData.minimum_threshold,
            unit_cost: itemData.unit_cost || null,
            supplier_name: itemData.supplier_name || null,
            supplier_contact: itemData.supplier_contact || null,
            expiry_date: itemData.expiry_date || null,
          })
          .select(`
            *,
            category:inventory_categories(*)
          `)
          .single();
      };

      const initialCode = generateItemCode();

      let { data, error } = await tryInsert(initialCode);

      // If unique constraint fails (e.g. item_code), regenerate and retry once.
      if (error && error.code === '23505' && isLikelyAutoCode(initialCode)) {
        const retryCode = generateItemCode();
        ({ data, error } = await tryInsert(retryCode));
      }

      if (error) {
        if (error.code === '23505') {
          throw new Error('Duplicate value detected (likely item code). Please change the Item Code and try again.');
        }
        throw error;
      }

      setItems((prev) => [mapRowToItem(data), ...prev]);
      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating item:', error);
      return { success: false, error: error.message };
    }
  };

  const updateItem = async (id: string, itemData: Partial<InventoryItem>) => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .update({
          item_name: itemData.item_name,
          category_id: itemData.category_id || null,
          unit_of_measure: itemData.unit_of_measure,
          current_quantity: itemData.current_quantity,
          minimum_threshold: itemData.minimum_threshold,
          unit_cost: itemData.unit_cost || null,
          supplier_name: itemData.supplier_name || null,
          supplier_contact: itemData.supplier_contact || null,
          expiry_date: itemData.expiry_date || null,
        })
        .eq('id', id)
        .select(`
          *,
          category:inventory_categories(*)
        `)
        .single();

      if (error) throw error;
      setItems((prev) => prev.map((it) => (it.id === id ? mapRowToItem(data) : it)));
      return { success: true };
    } catch (error: any) {
      console.error('Error updating item:', error);
      if (error?.code === '23505') {
        return { success: false, error: 'Duplicate value detected (likely item code). Please choose a different Item Code.' };
      }
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

      const { data: sessionData } = await supabase.auth.getSession();

      // Record movement
      const { data: insertedMovement, error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          inventory_item_id: itemId,
          movement_type: movementData.movement_type,
          quantity: movementData.quantity,
          previous_quantity: item.current_quantity,
          new_quantity: newQuantity,
          unit_cost: movementData.unit_cost || null,
          notes: movementData.notes || null,
          created_by: sessionData.session?.user?.id,
        })
        .select(`
          *,
          item:inventory_items(
            *,
            category:inventory_categories(*)
          )
        `)
        .single();

      if (movementError) throw movementError;

      // Update item quantity (status will be auto-updated by trigger)
      const { data: updatedItem, error: updateError } = await supabase
        .from('inventory_items')
        .update({
          current_quantity: newQuantity,
          unit_cost: movementData.unit_cost || item.unit_cost,
        })
        .eq('id', itemId)
        .select(`
          *,
          category:inventory_categories(*)
        `)
        .single();

      if (updateError) throw updateError;
      setItems((prev) => prev.map((it) => (it.id === itemId ? mapRowToItem(updatedItem) : it)));

      if (insertedMovement) {
        setMovements((prev) => [mapRowToMovement(insertedMovement), ...prev]);
      }
      return { success: true };
    } catch (error: any) {
      console.error('Error recording movement:', error);
      return { success: false, error: error.message };
    }
  };

  const createCategory = async (name: string, description?: string) => {
    try {
      // Get user's clinic_id to ensure category is created for the correct clinic
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        throw new Error('User not authenticated');
      }

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('clinic_id')
        .eq('user_id', sessionData.session.user.id)
        .single();

      if (!userRole?.clinic_id) {
        throw new Error('User not assigned to a clinic');
      }

      // Check if category with same name already exists (globally or in this clinic)
      const { data: existingCategory } = await supabase
        .from('inventory_categories')
        .select('id, name, clinic_id')
        .eq('name', name.trim())
        .maybeSingle();

      if (existingCategory) {
        if (existingCategory.clinic_id === userRole.clinic_id) {
          return { success: false, error: 'A category with this name already exists in your clinic' };
        } else {
          // Category exists in another clinic but due to global constraint, we can't create it
          return { success: false, error: 'A category with this name already exists. Please choose a different name.' };
        }
      }

      const { data, error } = await supabase
        .from('inventory_categories')
        .insert({ 
          name: name.trim(), 
          description: description?.trim() || null,
          clinic_id: userRole.clinic_id,
        })
        .select()
        .single();

      if (error) throw error;
      setCategories((prev) =>
        [...prev, { id: data.id, name: data.name, description: data.description }].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating category:', error);
      
      // Handle duplicate key error specifically
      if (error.code === '23505') {
        return { success: false, error: 'A category with this name already exists. Please choose a different name.' };
      }
      
      return { success: false, error: error.message };
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setItems((prev) => prev.filter((item) => item.id !== id));
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }
  };

  const updateCategory = async (id: string, name: string, description?: string) => {
    try {
      // Check if category with same name already exists (excluding current one)
      const { data: existingCategory } = await supabase
        .from('inventory_categories')
        .select('id, name, clinic_id')
        .eq('name', name.trim())
        .neq('id', id)
        .maybeSingle();

      if (existingCategory) {
        return { success: false, error: 'A category with this name already exists. Please choose a different name.' };
      }

      const { data, error } = await supabase
        .from('inventory_categories')
        .update({ 
          name: name.trim(), 
          description: description?.trim() || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setCategories((prev) => 
        prev.map((cat) => 
          cat.id === id 
            ? { id: data.id, name: data.name, description: data.description }
            : cat
        ).sort((a, b) => a.name.localeCompare(b.name))
      );
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating category:', error);
      
      // Handle duplicate key error specifically
      if (error.code === '23505') {
        return { success: false, error: 'A category with this name already exists. Please choose a different name.' };
      }
      
      return { success: false, error: error.message };
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      // Check if any items are using this category
      const { data: itemsUsingCategory } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('category_id', id)
        .limit(1);

      if (itemsUsingCategory && itemsUsingCategory.length > 0) {
        return { success: false, error: 'Cannot delete category that is being used by inventory items. Please update or delete the items first.' };
      }

      const { error } = await supabase
        .from('inventory_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCategories((prev) => prev.filter((cat) => cat.id !== id));
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchMovements();
  }, [fetchItems, fetchCategories, fetchMovements]);

  return {
    items,
    categories,
    movements,
    isLoading,
    fetchItems,
    fetchCategories,
    fetchMovements,
    createItem,
    updateItem,
    recordMovement,
    createCategory,
    updateCategory,
    deleteItem,
    deleteCategory,
  };
}
