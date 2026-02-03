import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  X,
  AlertCircle,
  Loader2,
  Share2,
} from 'lucide-react';
import { useAppointments, usePatients } from '@/hooks';
import { Appointment, AppointmentStatus, AppointmentType } from '@/types';
import { useToast } from '@/hooks';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const timeSlots = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

const statusColors: Record<AppointmentStatus, string> = {
  scheduled: 'bg-status-scheduled text-white',
  confirmed: 'bg-status-confirmed text-white',
  completed: 'bg-status-completed text-white',
  cancelled: 'bg-status-cancelled text-white',
  no_show: 'bg-muted text-muted-foreground',
};

const statusBadgeColors: Record<AppointmentStatus, string> = {
  scheduled: 'bg-status-scheduled/10 text-status-scheduled border-status-scheduled/20',
  confirmed: 'bg-status-confirmed/10 text-status-confirmed border-status-confirmed/20',
  completed: 'bg-status-completed/10 text-status-completed border-status-completed/20',
  cancelled: 'bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20',
  no_show: 'bg-muted text-muted-foreground border-border',
};

const durationOptions = [
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
];

const appointmentTypeOptions: Array<{ value: AppointmentType; label: string }> = [
  { value: 'Checkup', label: 'Checkup' },
  { value: 'Cleaning', label: 'Cleaning' },
  { value: 'Filling', label: 'Filling' },
  { value: 'Root Canal', label: 'Root Canal' },
  { value: 'Extraction', label: 'Extraction' },
  { value: 'Crown', label: 'Crown' },
  { value: 'Other', label: 'Other' },
];

export default function Appointments() {
  const { appointments, isLoading, isRefreshing, createAppointment, updateAppointmentStatus } = useAppointments();
  const { patients, createPatient } = usePatients();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTempPatientMode, setIsTempPatientMode] = useState(false);
  const [tempPatientForm, setTempPatientForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [isTempPatientSubmitting, setIsTempPatientSubmitting] = useState(false);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    patient_id: '',
    appointment_date: '',
    start_time: '',
    duration: '30',
    appointment_type: '' as AppointmentType | '',
    reason_for_visit: '',
    notes: '',
  });

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const formatDisplayDate = (date: Date) => date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const goToToday = () => setSelectedDate(new Date());

  const todayAppointments = appointments.filter(
    a => a.appointment_date === formatDate(selectedDate)
  );

  const sortedAppointments = [...todayAppointments].sort((a, b) => a.start_time.localeCompare(b.start_time));

  const getAppointmentForTimeSlot = (time: string) => {
    return todayAppointments.find(a => a.start_time === time);
  };

  const getPatientForAppointment = (appointment: Appointment) => {
    return appointment.patient || patients.find((p) => p.id === appointment.patient_id);
  };

  const formatTime12h = (time: string) => {
    const s = String(time || '').trim();
    if (!s) return '';
    const [hhStr, mmStr] = s.split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return s;
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const parseTimeToSeconds = (time: string) => {
    const s = String(time || '').trim();
    const [hhStr, mmStr] = s.split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
    return hh * 3600 + mm * 60;
  };

  const getNowSecondsOfDay = () => {
    const n = new Date();
    return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
  };

  const isDateToday = (dateStr: string) => {
    if (!dateStr) return false;
    return dateStr === formatDate(new Date());
  };

  const isPastDay = (dateStr: string) => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(`${dateStr}T00:00:00`);
    return d.getTime() < today.getTime();
  };

  const canOpenScheduleDialog = (dateStr: string, startTime?: string) => {
    if (!dateStr) return true;
    if (isPastDay(dateStr)) return false;
    if (!startTime) return true;
    const start = new Date(`${dateStr}T${startTime}:00`);
    return start.getTime() > Date.now();
  };

  const addMinutes = (time: string, minutes: number) => {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  const isSlotConflicting = (dateStr: string, startTime: string, endTime: string) => {
    return appointments.some((a) => {
      if (a.appointment_date !== dateStr) return false;
      if (a.status === 'cancelled') return false;
      return (
        (startTime >= a.start_time && startTime < a.end_time) ||
        (endTime > a.start_time && endTime <= a.end_time)
      );
    });
  };

  const availableStartTimes = (() => {
    if (!isDateToday(formData.appointment_date)) return timeSlots;
    const nowSec = getNowSecondsOfDay();
    return timeSlots.filter((t) => {
      const sec = parseTimeToSeconds(t);
      return Number.isFinite(sec) && sec > nowSec;
    });
  })();

  const availableSlotsForSelectedDate = (() => {
    const dateStr = formatDate(selectedDate);
    const candidateSlots = isDateToday(dateStr)
      ? timeSlots.filter((t) => {
          const sec = parseTimeToSeconds(t);
          return Number.isFinite(sec) && sec > getNowSecondsOfDay();
        })
      : timeSlots;

    const available = candidateSlots.filter((t) => {
      if (!canOpenScheduleDialog(dateStr, t)) return false;
      const endTime = addMinutes(t, 30);
      return !isSlotConflicting(dateStr, t, endTime);
    });

    return showAllSlots ? available : available.slice(0, 16);
  })();

  const openCreateForm = () => {
    const dateStr = formatDate(selectedDate);
    if (isPastDay(dateStr)) {
      toast({
        title: 'Cannot Schedule in the Past',
        description: 'Please choose today or a future date for a new appointment.',
        variant: 'destructive',
      });
      return;
    }
    setFormData({
      patient_id: '',
      appointment_date: dateStr,
      start_time: '',
      duration: '30',
      appointment_type: '',
      reason_for_visit: '',
      notes: '',
    });
    setIsFormOpen(true);
  };

  const openAppointmentDetail = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsDetailOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patient_id || !formData.appointment_date || !formData.start_time || !formData.appointment_type) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const endTime = addMinutes(formData.start_time, parseInt(formData.duration));

    // Strictly prevent scheduling in the past (even 1 second ago)
    const startDateTime = new Date(`${formData.appointment_date}T${formData.start_time}:00`);
    if (!(startDateTime.getTime() > Date.now())) {
      toast({
        title: 'Invalid Time',
        description: 'You cannot schedule an appointment in the past. Please choose a future time.',
        variant: 'destructive',
      });
      return;
    }
    const hasConflict = appointments.some(a => {
      if (a.appointment_date !== formData.appointment_date) return false;
      if (a.status === 'cancelled') return false;
      return (
        (formData.start_time >= a.start_time && formData.start_time < a.end_time) ||
        (endTime > a.start_time && endTime <= a.end_time)
      );
    });

    if (hasConflict) {
      toast({
        title: 'Time Conflict',
        description: 'This time slot overlaps with another appointment',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await createAppointment({
      patient_id: formData.patient_id,
      appointment_date: formData.appointment_date,
      start_time: formData.start_time,
      end_time: endTime,
      appointment_type: formData.appointment_type as AppointmentType,
      reason_for_visit: formData.reason_for_visit,
      notes: formData.notes,
    });

    if (result.success) {
      const patient = patients.find(p => p.id === formData.patient_id);
      setIsFormOpen(false);
      toast({
        title: 'Appointment Created',
        description: `Appointment scheduled for ${patient?.first_name} ${patient?.last_name}`,
      });
    } else {
      const rawError = result.error || 'Failed to create appointment';
      const isTypeEnumError =
        rawError.toLowerCase().includes('invalid input value for enum') &&
        rawError.toLowerCase().includes('appointment_type');

      toast({
        title: 'Error',
        description: isTypeEnumError
          ? 'This appointment type is not allowed by the database. Please pick a type from the dropdown. If the dropdown is wrong/empty, the DB enum values need to be configured.'
          : rawError,
        variant: 'destructive',
      });
    }
    setIsSubmitting(false);
  };

  const handleCreateTempPatient = async () => {
    const first_name = tempPatientForm.first_name.trim();
    const last_name = tempPatientForm.last_name.trim();
    const phone = tempPatientForm.phone.trim();

    if (!first_name || !last_name || !phone) {
      toast({
        title: 'Validation Error',
        description: 'Please enter first name, last name, and phone number.',
        variant: 'destructive',
      });
      return;
    }

    setIsTempPatientSubmitting(true);
    try {
      const created = await createPatient({
        first_name,
        last_name,
        phone,
        email: '',
        date_of_birth: undefined,
        gender: undefined,
        address: '',
        city: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        allergies: '',
        current_medications: '',
        medical_conditions: '',
        notes: '',
        status: 'lead',
        created_by: undefined,
        balance: 0,
        last_visit_date: undefined,
        archived_at: undefined,
      });

      if (!created.success || !created.data) {
        throw new Error(created.error || 'Failed to create customer');
      }

      const patientId = created.data.id;
      if (!patientId) {
        throw new Error('Failed to create customer');
      }

      setFormData((prev) => ({ ...prev, patient_id: patientId }));
      setIsTempPatientMode(false);
      setTempPatientForm({ first_name: '', last_name: '', phone: '' });
      toast({ title: 'Temporary customer added', description: 'You can now schedule the appointment.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create customer';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsTempPatientSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: AppointmentStatus) => {
    const result = await updateAppointmentStatus(id, status);
    setIsDetailOpen(false);
    if (result.success) {
      toast({
        title: 'Status Updated',
        description: `Appointment marked as ${status.replace('_', ' ')}`,
      });
    }
  };

  const shareAppointmentWhatsApp = (appointment: Appointment) => {
    const raw = (appointment.patient?.phone || '').trim();
    const digits = raw.replace(/\D+/g, '');
    const phone = digits.startsWith('0') ? digits.slice(1) : digits;

    if (!phone) {
      toast({
        title: 'Missing Phone',
        description: 'This customer does not have a valid phone number for WhatsApp.',
        variant: 'destructive',
      });
      return;
    }

    const patientName = `${appointment.patient?.first_name || ''} ${appointment.patient?.last_name || ''}`.trim() || 'Customer';
    const msg =
      `Hi ${patientName},\n\n` +
      `Your appointment is confirmed.\n` +
      `Date: ${appointment.appointment_date}\n` +
      `Time: ${formatTime12h(appointment.start_time)} - ${formatTime12h(appointment.end_time)}\n` +
      `Type: ${appointment.appointment_type}\n\n` +
      `Please reply “OK” to confirm. Thanks.`;

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    const waWindow = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (!waWindow) {
      toast({
        title: 'Popup Blocked',
        description: 'Please allow popups to open WhatsApp.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading && appointments.length === 0) {
    return (
      <div className="min-h-screen">
        <Header title="Appointments" subtitle="Manage your daily appointments" />
        <div className="p-4 sm:p-6 space-y-6">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Appointments" subtitle="Manage your daily appointments" />
      
      <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToToday}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-base sm:text-lg font-semibold sm:ml-4">{formatDisplayDate(selectedDate)}</h2>
          </div>
          <Button onClick={openCreateForm} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>

        {isRefreshing && (
          <div className="text-xs text-muted-foreground">Updating…</div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="p-4 sm:p-6 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Appointments</h3>
                <Badge variant="outline" className="text-xs">
                  {sortedAppointments.length} total
                </Badge>
              </div>

              {sortedAppointments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No appointments for this date.</div>
              ) : (
                <div className="space-y-3">
                  {sortedAppointments.map((appointment) => {
                    const patient = getPatientForAppointment(appointment);
                    return (
                      <button
                        key={appointment.id}
                        onClick={() => openAppointmentDetail(appointment)}
                        className={cn(
                          'w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">
                                {formatTime12h(appointment.start_time)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime12h(appointment.end_time)}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn('ml-2 capitalize', statusBadgeColors[appointment.status])}
                              >
                                {appointment.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm font-medium truncate">
                              {patient?.first_name} {patient?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {appointment.appointment_type}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Available slots</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllSlots((v) => !v)}
                    className="h-7 px-2 text-xs"
                  >
                    {showAllSlots ? 'Show less' : 'Show all'}
                  </Button>
                </div>

                {availableSlotsForSelectedDate.length === 0 ? (
                  <div className="mt-2 text-sm text-muted-foreground">No available future slots.</div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableSlotsForSelectedDate.map((time) => (
                      <Button
                        key={time}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => {
                          const dateStr = formatDate(selectedDate);
                          if (!canOpenScheduleDialog(dateStr, time)) {
                            toast({
                              title: 'Cannot Schedule in the Past',
                              description: 'Please pick a future time slot.',
                              variant: 'destructive',
                            });
                            return;
                          }

                          setFormData((prev) => ({
                            ...prev,
                            appointment_date: dateStr,
                            start_time: time,
                          }));
                          setIsFormOpen(true);
                        }}
                      >
                        {formatTime12h(time)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 rounded-full bg-status-scheduled" />
            <span>Scheduled ({todayAppointments.filter(a => a.status === 'scheduled').length})</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 rounded-full bg-status-confirmed" />
            <span>Confirmed ({todayAppointments.filter(a => a.status === 'confirmed').length})</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 rounded-full bg-status-completed" />
            <span>Completed ({todayAppointments.filter(a => a.status === 'completed').length})</span>
          </div>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Appointment</DialogTitle>
            <DialogDescription>Book a new appointment for a customer</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Customer *</label>
              <Popover open={isCustomerPickerOpen} onOpenChange={setIsCustomerPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isCustomerPickerOpen}
                    className="w-full justify-between"
                  >
                    {(() => {
                      const selected = patients.find((p) => p.id === formData.patient_id);
                      if (!selected) return <span className="text-muted-foreground">Select a customer</span>;
                      return (
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">
                            {selected.first_name} {selected.last_name} ({selected.patient_number})
                          </span>
                          {selected.status === 'lead' && (
                            <Badge variant="secondary" className="shrink-0 border border-primary/20 bg-primary/10 text-primary">
                              Temp
                            </Badge>
                          )}
                        </span>
                      );
                    })()}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search customers..." />
                    <CommandList
                      className="max-h-[320px] overflow-y-auto overscroll-contain"
                      onWheel={(e) => {
                        e.stopPropagation();
                        const el = e.currentTarget as HTMLDivElement;
                        el.scrollTop += e.deltaY;
                      }}
                    >
                      <CommandEmpty>No customers found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__create_temp_customer__"
                          className="font-bold text-primary bg-primary/15 border border-primary/20 data-[selected=true]:bg-primary/25 data-[selected=true]:text-primary"
                          onSelect={() => {
                            setIsTempPatientMode(true);
                            setIsCustomerPickerOpen(false);
                          }}
                        >
                          + Add temporary customer
                        </CommandItem>
                      </CommandGroup>
                      <CommandGroup>
                        {patients
                          .filter((p) => p.status === 'active' || p.status === 'lead')
                          .map((p) => {
                            const label = `${p.first_name} ${p.last_name} (${p.patient_number})`;
                            const searchValue = `${p.first_name} ${p.last_name} ${p.patient_number} ${p.phone || ''}`;
                            const isSelected = formData.patient_id === p.id;
                            const isTemp = p.status === 'lead';
                            return (
                              <CommandItem
                                key={p.id}
                                value={searchValue}
                                onSelect={() => {
                                  setIsTempPatientMode(false);
                                  setFormData((prev) => ({ ...prev, patient_id: p.id }));
                                  setIsCustomerPickerOpen(false);
                                }}
                                className={cn(
                                  isTemp && 'bg-primary/5 border border-primary/10',
                                )}
                              >
                                <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                  <span className={cn('truncate', isTemp && 'text-primary')}>
                                    {label}
                                  </span>
                                  {isTemp && (
                                    <Badge variant="secondary" className="shrink-0 border border-primary/20 bg-primary/10 text-primary">
                                      Temp
                                    </Badge>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {isTempPatientMode && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">First Name *</label>
                    <Input
                      value={tempPatientForm.first_name}
                      onChange={(e) => setTempPatientForm((prev) => ({ ...prev, first_name: e.target.value }))}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="form-label">Last Name *</label>
                    <Input
                      value={tempPatientForm.last_name}
                      onChange={(e) => setTempPatientForm((prev) => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Phone *</label>
                  <Input
                    value={tempPatientForm.phone}
                    onChange={(e) => setTempPatientForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Phone number"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsTempPatientMode(false);
                      setTempPatientForm({ first_name: '', last_name: '', phone: '' });
                    }}
                    disabled={isTempPatientSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleCreateTempPatient} disabled={isTempPatientSubmitting}>
                    {isTempPatientSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Temporary Customer
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Date *</label>
                <Input
                  type="date"
                  value={formData.appointment_date}
                  onChange={(e) => setFormData({...formData, appointment_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="form-label">Start Time *</label>
                <Select value={formData.start_time} onValueChange={(v) => setFormData({...formData, start_time: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStartTimes.map(time => (
                      <SelectItem key={time} value={time}>{formatTime12h(time)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Duration *</label>
                <Select value={formData.duration} onValueChange={(v) => setFormData({...formData, duration: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durationOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="form-label">Type *</label>
                <Select value={formData.appointment_type} onValueChange={(v) => setFormData({...formData, appointment_type: v as AppointmentType})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentTypeOptions.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="form-label">Reason for Visit</label>
              <Textarea
                value={formData.reason_for_visit}
                onChange={(e) => setFormData({...formData, reason_for_visit: e.target.value})}
                placeholder="Describe the reason for visit"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Schedule Appointment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            (() => {
              const patient = getPatientForAppointment(selectedAppointment);
              const mergedAppointment = {
                ...selectedAppointment,
                patient: selectedAppointment.patient || patient,
              } as Appointment;
              return (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {mergedAppointment.patient?.first_name?.[0]}{mergedAppointment.patient?.last_name?.[0]}
                </div>
                <div>
                  <h3 className="font-semibold">
                    {mergedAppointment.patient?.first_name} {mergedAppointment.patient?.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{mergedAppointment.patient?.phone}</p>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn('ml-auto capitalize', statusBadgeColors[selectedAppointment.status])}
                >
                  {selectedAppointment.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedAppointment.appointment_date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{formatTime12h(selectedAppointment.start_time)} - {formatTime12h(selectedAppointment.end_time)}</span>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">{selectedAppointment.appointment_type}</p>
                {selectedAppointment.reason_for_visit && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedAppointment.reason_for_visit}</p>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => shareAppointmentWhatsApp(mergedAppointment)}
                disabled={!mergedAppointment.patient?.phone}
              >
                <Share2 className="h-4 w-4 mr-2" />
                WhatsApp Confirmation
              </Button>

              {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleStatusUpdate(selectedAppointment.id, 'confirmed')}>
                    <Check className="h-4 w-4 mr-1" /> Confirm
                  </Button>
                  <Button size="sm" variant="default" className="flex-1" onClick={() => handleStatusUpdate(selectedAppointment.id, 'completed')}>
                    <Check className="h-4 w-4 mr-1" /> Complete
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate(selectedAppointment.id, 'cancelled')}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleStatusUpdate(selectedAppointment.id, 'no_show')}>
                    <AlertCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
              );
            })()
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
