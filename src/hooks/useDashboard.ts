import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardStats, Appointment, AppointmentStatus, Patient } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    today: {
      revenue: 0,
      appointments_scheduled: 0,
      appointments_completed: 0,
      new_patients: 0,
    },
    month: {
      revenue: 0,
      outstanding: 0,
      total_treatments: 0,
    },
    alerts: {
      low_stock_count: 0,
      overdue_invoices_count: 0,
    },
  });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [revenueData, setRevenueData] = useState<{ day: string; revenue: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Fetch today's appointments with patient info
      const { data: appointmentsData, error: appError } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(*)
        `)
        .eq('appointment_date', today)
        .order('start_time');

      if (appError) throw appError;

      const mappedAppointments: Appointment[] = (appointmentsData || []).map((a) => ({
        id: a.id,
        patient_id: a.patient_id,
        dentist_id: a.dentist_id,
        appointment_date: a.appointment_date,
        start_time: a.start_time,
        end_time: a.end_time,
        appointment_type: a.appointment_type,
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
          status: a.patient.status,
          registration_date: a.patient.registration_date,
          created_at: a.patient.created_at,
        } as Patient : undefined,
      }));

      setTodayAppointments(mappedAppointments);

      // Fetch new patients today
      const { count: newPatientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      // Fetch today's paid invoices for revenue
      const { data: todayInvoices } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', today)
        .lte('payment_date', today);

      const todayRevenue = (todayInvoices || []).reduce((sum, p) => sum + Number(p.amount), 0);

      // Fetch month's revenue
      const { data: monthPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', startOfMonth);

      const monthRevenue = (monthPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);

      // Fetch outstanding invoices
      const { data: outstandingData } = await supabase
        .from('invoices')
        .select('balance')
        .neq('status', 'paid');

      const outstanding = (outstandingData || []).reduce((sum, i) => sum + Number(i.balance), 0);

      // Fetch month's completed appointments (treatments)
      const { count: treatmentsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('appointment_date', startOfMonth);

      // Fetch low stock items
      const { count: lowStockCount } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .in('status', ['low_stock', 'out_of_stock']);

      // Fetch overdue invoices
      const { count: overdueCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'overdue');

      // Calculate appointments stats
      const scheduledOrConfirmed = mappedAppointments.filter(
        a => a.status === 'scheduled' || a.status === 'confirmed'
      ).length;
      const completed = mappedAppointments.filter(a => a.status === 'completed').length;

      setStats({
        today: {
          revenue: todayRevenue,
          appointments_scheduled: scheduledOrConfirmed,
          appointments_completed: completed,
          new_patients: newPatientsCount || 0,
        },
        month: {
          revenue: monthRevenue,
          outstanding,
          total_treatments: treatmentsCount || 0,
        },
        alerts: {
          low_stock_count: lowStockCount || 0,
          overdue_invoices_count: overdueCount || 0,
        },
      });

      // Fetch last 7 days revenue for chart
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
      }

      const { data: weekPayments } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .gte('payment_date', last7Days[0])
        .lte('payment_date', last7Days[6]);

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const chartData = last7Days.map(date => {
        const dayRevenue = (weekPayments || [])
          .filter(p => p.payment_date === date)
          .reduce((sum, p) => sum + Number(p.amount), 0);
        
        return {
          day: dayNames[new Date(date).getDay()],
          revenue: dayRevenue,
        };
      });

      setRevenueData(chartData);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch dashboard data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    stats,
    todayAppointments,
    revenueData,
    isLoading,
    fetchDashboardData,
  };
}
