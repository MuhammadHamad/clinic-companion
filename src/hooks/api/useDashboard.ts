import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { DashboardStats, Appointment, AppointmentStatus, Patient } from '@/types';
import { useToast } from '@/hooks';

export function useDashboard() {
  const defaultStats: DashboardStats = {
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
    year: {
      current_month: 0,
      previous_month: 0,
      ytd_revenue: 0,
      monthly_trend: [],
    },
    alerts: {
      low_stock_count: 0,
      overdue_invoices_count: 0,
    },
  };
  const { toast } = useToast();

  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const todayStart = `${today}T00:00:00`;
      const todayEnd = `${today}T23:59:59`;
      const startOfMonthTs = `${startOfMonth}T00:00:00`;
      const startOfYearTs = `${startOfYear}T00:00:00`;
      
      // Generate month keys for the current calendar year (Jan–Dec)
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonthIndex = currentDate.getMonth(); // 0 = Jan, 11 = Dec
      const last12Months = Array.from({ length: 12 }, (_, monthIndex) => {
        const monthNumber = String(monthIndex + 1).padStart(2, '0');
        return `${currentYear}-${monthNumber}`; // YYYY-MM for each month in the year
      });

      // Parallel fetch all dashboard data
      const [
        appointmentsResult,
        newPatientsResult,
        todayPaymentsResult,
        monthPaymentsResult,
        yearPaymentsResult,
        outstandingResult,
        treatmentsResult,
        lowStockResult,
        overdueResult,
        weekPaymentsResult
      ] = await Promise.all([
        // Today's appointments with patient info
        supabase
          .from('appointments')
          .select(`
            *,
            patient:patients(*)
          `)
          .eq('appointment_date', today)
          .order('start_time'),
        
        // New patients today
        supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`),
        
        // Today's payments for revenue
        supabase
          .from('payments')
          .select('amount')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        
        // Month's revenue
        supabase
          .from('payments')
          .select('amount')
          .gte('created_at', startOfMonthTs),
        
        // Year's revenue + data for monthly trend
        supabase
          .from('payments')
          .select('amount, payment_date, created_at')
          .gte('created_at', startOfYearTs),
        
        // Outstanding invoices
        supabase
          .from('invoices')
          .select('balance')
          .neq('status', 'paid'),
        
        // Month's completed appointments
        supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('appointment_date', startOfMonth),
        
        // Low stock items
        supabase
          .from('inventory_items')
          .select('*', { count: 'exact', head: true })
          .in('status', ['low_stock', 'out_of_stock']),
        
        // Overdue invoices
        supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'overdue'),
        
        // Last 7 days revenue for chart
        (() => {
          const last7Days = [];
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toISOString().split('T')[0]);
          }
          return supabase
            .from('payments')
            .select('amount, payment_date, created_at')
            .gte('created_at', `${last7Days[0]}T00:00:00`)
            .lte('created_at', `${last7Days[6]}T23:59:59`);
        })()
      ]);

      // Process appointments data
      const { data: appointmentsData, error: appError } = appointmentsResult;
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

      // Process other data
      const todayRevenue = (todayPaymentsResult.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const monthRevenue = (monthPaymentsResult.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const yearRevenue = (yearPaymentsResult.data || []).reduce((sum, p: any) => sum + Number(p.amount), 0);
      const outstanding = (outstandingResult.data || []).reduce((sum, i) => sum + Number(i.balance), 0);

      // Calculate monthly trend: show current month's revenue, keep other months at 0 for now
      const currentMonthKey = today.slice(0, 7); // YYYY-MM
      const monthlyTrend = last12Months.map((monthKey) => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthDate = new Date(monthKey + '-01');
        const isCurrentMonth = monthKey === currentMonthKey;

        return {
          month: monthNames[monthDate.getMonth()],
          revenue: isCurrentMonth ? monthRevenue : 0,
        };
      });

      // Current and previous month revenue based on the trend
      const currentMonthIndexInTrend = last12Months.indexOf(currentMonthKey);
      const currentMonthRevenue =
        currentMonthIndexInTrend !== -1
          ? monthlyTrend[currentMonthIndexInTrend].revenue
          : monthRevenue;
      const previousMonthRevenue =
        currentMonthIndexInTrend > 0
          ? monthlyTrend[currentMonthIndexInTrend - 1].revenue
          : 0;

      // Calculate appointments stats
      const scheduledOrConfirmed = mappedAppointments.filter(
        a => a.status === 'scheduled' || a.status === 'confirmed'
      ).length;
      const completed = mappedAppointments.filter(a => a.status === 'completed').length;

      const stats: DashboardStats = {
        today: {
          revenue: todayRevenue,
          appointments_scheduled: scheduledOrConfirmed,
          appointments_completed: completed,
          new_patients: newPatientsResult.count || 0,
        },
        month: {
          revenue: monthRevenue,
          outstanding,
          total_treatments: treatmentsResult.count || 0,
        },
        year: {
          current_month: currentMonthRevenue,
          previous_month: previousMonthRevenue,
          ytd_revenue: yearRevenue,
          monthly_trend: monthlyTrend,
        },
        alerts: {
          low_stock_count: lowStockResult.count || 0,
          overdue_invoices_count: overdueResult.count || 0,
        },
      };

      // Process chart data
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
      }

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const chartData = last7Days.map(date => {
        const dayRevenue = (weekPaymentsResult.data || [])
          .filter((p: any) => (p.payment_date || (p.created_at ? String(p.created_at).split('T')[0] : '')) === date)
          .reduce((sum, p) => sum + Number(p.amount), 0);
        
        return {
          day: dayNames[new Date(date).getDay()],
          revenue: dayRevenue,
        };
      });

      return {
        stats,
        todayAppointments: mappedAppointments,
        revenueData: chartData,
      };
    } catch (error: any) {
      logger.error('Error fetching dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch dashboard data',
        variant: 'destructive',
      });
      throw error;
    } finally {
    }
  }, [toast]);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const result = await fetchDashboardData();
      setLastUpdated(new Date());
      return result;
    },
    placeholderData: (prev) => prev,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const handleRefresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    stats: query.data?.stats ?? defaultStats,
    todayAppointments: query.data?.todayAppointments ?? [],
    revenueData: query.data?.revenueData ?? [],
    isLoading: query.isLoading && !query.data,
    isRefreshing: query.isFetching && !!query.data,
    lastUpdated,
    refresh: handleRefresh,
  };
}
