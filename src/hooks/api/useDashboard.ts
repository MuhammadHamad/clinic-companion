import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { DashboardStats, Appointment, AppointmentStatus, Patient } from '@/types';
import { useToast } from '@/hooks';
import { useTenant } from '@/contexts/TenantContext';

const formatLocalDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toHHMM = (value: unknown) => {
  const s = String(value || '').trim();
  if (!s) return s;
  const parts = s.split(':');
  if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  return s;
};

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
  const { activeClinicId } = useTenant();

  const fetchDashboardData = useCallback(async () => {
    try {
      if (!activeClinicId) {
        return {
          stats: defaultStats,
          todayAppointments: [],
          revenueData: [],
          revenueSeries: {
            week: [],
            month: [],
            year: [],
            allTime: [],
          },
        };
      }

      const now = new Date();
      const today = formatLocalDate(now);
      const startOfMonth = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const startOfYear = formatLocalDate(new Date(now.getFullYear(), 0, 1));
      const startOfAllTime = formatLocalDate(new Date(now.getFullYear() - 4, 0, 1));

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
        weekPaymentsResult,
        monthPaymentsTrendResult,
        allTimePaymentsResult
      ] = await Promise.all([
        // Today's appointments with patient info
        supabase
          .from('appointments')
          .select(`
            *,
            patient:patients(*)
          `)
          .eq('clinic_id', activeClinicId)
          .eq('appointment_date', today)
          .order('start_time'),
        
        // New patients today
        supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', activeClinicId)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`),
        
        // Today's payments for revenue
        supabase
          .from('payments')
          .select('amount')
          .eq('clinic_id', activeClinicId)
          .eq('payment_date', today),
        
        // Month's revenue
        supabase
          .from('payments')
          .select('amount')
          .eq('clinic_id', activeClinicId)
          .gte('payment_date', startOfMonth)
          .lte('payment_date', today),
        
        // Year's revenue + data for monthly trend
        supabase
          .from('payments')
          .select('amount, payment_date, created_at')
          .eq('clinic_id', activeClinicId)
          .gte('payment_date', startOfYear)
          .lte('payment_date', today),
        
        // Outstanding invoices
        supabase
          .from('invoices')
          .select('balance')
          .eq('clinic_id', activeClinicId)
          .neq('status', 'paid'),
        
        // Month's completed appointments
        supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', activeClinicId)
          .eq('status', 'completed')
          .gte('appointment_date', startOfMonth),
        
        // Low stock items
        supabase
          .from('inventory_items')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', activeClinicId)
          .in('status', ['low_stock', 'out_of_stock']),
        
        // Overdue invoices
        supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', activeClinicId)
          .eq('status', 'overdue'),
        
        // Last 7 days revenue for chart
        (() => {
          const last7Days = [];
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(formatLocalDate(date));
          }
          return supabase
            .from('payments')
            .select('amount, payment_date, created_at')
            .eq('clinic_id', activeClinicId)
            .gte('payment_date', last7Days[0])
            .lte('payment_date', last7Days[6]);
        })(),

        // Current month daily revenue (for chart)
        supabase
          .from('payments')
          .select('amount, payment_date, created_at')
          .eq('clinic_id', activeClinicId)
          .gte('payment_date', startOfMonth)
          .lte('payment_date', today),

        // All time (last 5 years) revenue (for chart)
        supabase
          .from('payments')
          .select('amount, payment_date, created_at')
          .eq('clinic_id', activeClinicId)
          .gte('payment_date', startOfAllTime)
      ]);

      // Process appointments data
      const { data: appointmentsData, error: appError } = appointmentsResult;
      if (appError) throw appError;

      const mappedAppointments: Appointment[] = (appointmentsData || []).map((a) => ({
        id: a.id,
        patient_id: a.patient_id,
        dentist_id: a.dentist_id,
        appointment_date: a.appointment_date,
        start_time: toHHMM(a.start_time),
        end_time: toHHMM(a.end_time),
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

      const getPaymentDate = (p: any): Date | null => {
        const raw = p?.payment_date || (p?.created_at ? String(p.created_at).split('T')[0] : '');
        if (!raw) return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
      };

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Calculate monthly trend (current calendar year) from payments
      const monthTotals = Array.from({ length: 12 }, () => 0);
      (yearPaymentsResult.data || []).forEach((p: any) => {
        const d = getPaymentDate(p);
        if (!d) return;
        const idx = d.getMonth();
        if (idx < 0 || idx > 11) return;
        monthTotals[idx] += Number(p.amount) || 0;
      });

      const monthlyTrend = monthTotals.map((revenue, idx) => ({
        month: monthNames[idx],
        revenue,
      }));

      // Current and previous month revenue based on the trend
      const currentMonthIndexInTrend = now.getMonth();
      const currentMonthRevenue = monthlyTrend[currentMonthIndexInTrend]?.revenue ?? monthRevenue;
      const previousMonthRevenue = currentMonthIndexInTrend > 0 ? monthlyTrend[currentMonthIndexInTrend - 1]?.revenue ?? 0 : 0;

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
        last7Days.push(formatLocalDate(date));
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

      // Current month daily revenue series
      const monthDays: string[] = [];
      for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d <= now; d.setDate(d.getDate() + 1)) {
        monthDays.push(formatLocalDate(new Date(d)));
      }

      const monthSeries = monthDays.map((date) => {
        const total = (monthPaymentsTrendResult.data || [])
          .filter((p: any) => (p.payment_date || (p.created_at ? String(p.created_at).split('T')[0] : '')) === date)
          .reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          label: String(Number(date.split('-')[2]) || date),
          revenue: total,
        };
      });

      const yearSeries = monthlyTrend.map((m) => ({
        label: m.month,
        revenue: m.revenue,
      }));

      const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 4 + i);
      const allTimeTotals = new Map<number, number>(years.map((y) => [y, 0] as const));
      (allTimePaymentsResult.data || []).forEach((p: any) => {
        const d = getPaymentDate(p);
        if (!d) return;
        const y = d.getFullYear();
        if (!allTimeTotals.has(y)) return;
        allTimeTotals.set(y, (allTimeTotals.get(y) || 0) + (Number(p.amount) || 0));
      });

      const allTimeSeries = years.map((y) => ({
        label: String(y),
        revenue: allTimeTotals.get(y) || 0,
      }));

      return {
        stats,
        todayAppointments: mappedAppointments,
        revenueData: chartData,
        revenueSeries: {
          week: chartData.map((d) => ({ label: d.day, revenue: d.revenue })),
          month: monthSeries,
          year: yearSeries,
          allTime: allTimeSeries,
        },
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
  }, [activeClinicId, toast]);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const query = useQuery({
    queryKey: ['dashboard', activeClinicId],
    queryFn: async () => {
      const result = await fetchDashboardData();
      setLastUpdated(new Date());
      return result;
    },
    enabled: !!activeClinicId,
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
    revenueSeries: query.data?.revenueSeries ?? { week: [], month: [], year: [], allTime: [] },
    isLoading: query.isLoading && !query.data,
    isRefreshing: query.isFetching && !!query.data,
    lastUpdated,
    refresh: handleRefresh,
  };
}
