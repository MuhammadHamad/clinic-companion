import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  User,
  Calendar as CalendarIcon,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { mockAppointments, mockPatients, mockTreatmentTypes } from '@/data/mockData';
import { Appointment, AppointmentStatus, AppointmentType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
];

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

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
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

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
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

  const getAppointmentForTimeSlot = (time: string) => {
    return todayAppointments.find(a => a.start_time === time);
  };

  const addMinutes = (time: string, minutes: number) => {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  const openCreateForm = () => {
    setFormData({
      patient_id: '',
      appointment_date: formatDate(selectedDate),
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patient_id || !formData.appointment_date || !formData.start_time || !formData.appointment_type) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Check for conflicts
    const endTime = addMinutes(formData.start_time, parseInt(formData.duration));
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

    const patient = mockPatients.find(p => p.id === formData.patient_id);
    
    const newAppointment: Appointment = {
      id: String(Date.now()),
      patient_id: formData.patient_id,
      dentist_id: '2',
      appointment_date: formData.appointment_date,
      start_time: formData.start_time,
      end_time: endTime,
      appointment_type: formData.appointment_type as AppointmentType,
      status: 'scheduled',
      reason_for_visit: formData.reason_for_visit,
      notes: formData.notes,
      created_at: new Date().toISOString(),
      patient,
    };

    setAppointments([...appointments, newAppointment]);
    setIsFormOpen(false);
    toast({
      title: 'Appointment Created',
      description: `Appointment scheduled for ${patient?.first_name} ${patient?.last_name}`,
    });
  };

  const updateAppointmentStatus = (id: string, status: AppointmentStatus) => {
    setAppointments(appointments.map(a => 
      a.id === id ? { ...a, status } : a
    ));
    setIsDetailOpen(false);
    toast({
      title: 'Status Updated',
      description: `Appointment marked as ${status.replace('_', ' ')}`,
    });
  };

  return (
    <div className="min-h-screen">
      <Header title="Appointments" subtitle="Manage your daily appointments" />
      
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Date Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold ml-4">{formatDisplayDate(selectedDate)}</h2>
          </div>
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {timeSlots.map((time) => {
                const appointment = getAppointmentForTimeSlot(time);
                return (
                  <div key={time} className="flex min-h-[60px]">
                    <div className="w-20 py-3 px-4 text-sm text-muted-foreground font-medium border-r border-border bg-muted/30 flex items-center">
                      {time}
                    </div>
                    <div className="flex-1 p-2">
                      {appointment ? (
                        <button
                          onClick={() => openAppointmentDetail(appointment)}
                          className={cn(
                            'w-full h-full min-h-[44px] rounded-lg px-3 py-2 text-left transition-all hover:opacity-90',
                            statusColors[appointment.status]
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {appointment.patient?.first_name} {appointment.patient?.last_name}
                              </p>
                              <p className="text-xs opacity-80">
                                {appointment.appointment_type} • {appointment.start_time} - {appointment.end_time}
                              </p>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-white/50" />
                          </div>
                        </button>
                      ) : (
                        <div className="w-full h-full min-h-[44px] rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer flex items-center justify-center"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              appointment_date: formatDate(selectedDate),
                              start_time: time,
                            });
                            setIsFormOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
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
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 rounded-full bg-status-cancelled" />
            <span>Cancelled ({todayAppointments.filter(a => a.status === 'cancelled').length})</span>
          </div>
        </div>
      </div>

      {/* New Appointment Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Appointment</DialogTitle>
            <DialogDescription>Book a new appointment for a patient</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Patient *</label>
              <Select value={formData.patient_id} onValueChange={(v) => setFormData({...formData, patient_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {mockPatients.filter(p => p.status === 'active').map(patient => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name} ({patient.patient_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                    {timeSlots.map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
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
                    {mockTreatmentTypes.map(type => (
                      <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
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

            <div>
              <label className="form-label">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional notes"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Schedule Appointment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {selectedAppointment.patient?.first_name[0]}{selectedAppointment.patient?.last_name[0]}
                </div>
                <div>
                  <h3 className="font-semibold">
                    {selectedAppointment.patient?.first_name} {selectedAppointment.patient?.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedAppointment.patient?.phone}</p>
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
                  <span>{selectedAppointment.start_time} - {selectedAppointment.end_time}</span>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">{selectedAppointment.appointment_type}</p>
                {selectedAppointment.reason_for_visit && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedAppointment.reason_for_visit}</p>
                )}
              </div>

              {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && (
                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={() => updateAppointmentStatus(selectedAppointment.id, 'confirmed')}
                    disabled={selectedAppointment.status === 'confirmed'}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Confirm
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => updateAppointmentStatus(selectedAppointment.id, 'completed')}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Complete
                  </Button>
                  <Button 
                    variant="destructive"
                    size="icon"
                    onClick={() => updateAppointmentStatus(selectedAppointment.id, 'cancelled')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && (
                <Button 
                  variant="ghost" 
                  className="w-full text-muted-foreground"
                  onClick={() => updateAppointmentStatus(selectedAppointment.id, 'no_show')}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Mark as No-Show
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
