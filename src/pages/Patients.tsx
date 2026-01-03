import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Search, 
  Eye, 
  Pencil, 
  Phone, 
  Mail,
  Calendar,
  DollarSign,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
} from 'lucide-react';
import { usePatients } from '@/hooks/usePatients';
import { Patient } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function Patients() {
  const { patients, isLoading, createPatient, updatePatient, deletePatient } = usePatients();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: '',
    address: '',
    city: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    allergies: '',
    current_medications: '',
    medical_conditions: '',
    notes: '',
  });

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = 
      patient.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.phone.includes(searchQuery) ||
      patient.patient_number.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return '-';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const openCreateForm = () => {
    setFormMode('create');
    setFormData({
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      date_of_birth: '',
      gender: '',
      address: '',
      city: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      allergies: '',
      current_medications: '',
      medical_conditions: '',
      notes: '',
    });
    setIsFormOpen(true);
  };

  const openEditForm = (patient: Patient) => {
    setFormMode('edit');
    setSelectedPatient(patient);
    setFormData({
      first_name: patient.first_name,
      last_name: patient.last_name,
      phone: patient.phone,
      email: patient.email || '',
      date_of_birth: patient.date_of_birth || '',
      gender: patient.gender || '',
      address: patient.address || '',
      city: patient.city || '',
      emergency_contact_name: patient.emergency_contact_name || '',
      emergency_contact_phone: patient.emergency_contact_phone || '',
      allergies: patient.allergies || '',
      current_medications: patient.current_medications || '',
      medical_conditions: patient.medical_conditions || '',
      notes: patient.notes || '',
    });
    setIsFormOpen(true);
  };

  const openViewDialog = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsViewOpen(true);
  };

  const openDeleteDialog = (patient: Patient) => {
    setPatientToDelete(patient);
    setIsDeleteOpen(true);
  };

  const confirmDeletePatient = async () => {
    if (!patientToDelete) return;
    setIsDeleting(true);

    const result = await deletePatient(patientToDelete.id);

    if (result.success) {
      toast({
        title: 'Patient deleted',
        description: 'The patient record has been removed successfully.',
      });
      setIsDeleteOpen(false);
      setPatientToDelete(null);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete patient',
        variant: 'destructive',
      });
    }

    setIsDeleting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name || !formData.last_name || !formData.phone) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    if (formMode === 'create') {
      const result = await createPatient({
        ...formData,
        gender: formData.gender as 'male' | 'female' | 'other' | undefined,
        status: 'active',
        balance: 0,
      });

      if (result.success) {
        toast({
          title: 'Patient Created',
          description: `${formData.first_name} ${formData.last_name} has been registered successfully`,
        });
        setIsFormOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create patient',
          variant: 'destructive',
        });
      }
    } else if (selectedPatient) {
      const result = await updatePatient(selectedPatient.id, {
        ...formData,
        gender: formData.gender as 'male' | 'female' | 'other' | undefined,
      });

      if (result.success) {
        toast({
          title: 'Patient Updated',
          description: 'Patient information has been updated successfully',
        });
        setIsFormOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update patient',
          variant: 'destructive',
        });
      }
    }

    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Patients" subtitle="Manage your patient records" />
        <div className="p-6 space-y-6">
          <div className="flex gap-4 justify-between">
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Patients" subtitle="Manage your patient records" />
      
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or patient #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            Add Patient
          </Button>
        </div>

        {/* Patients Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Patient #</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Age</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">Last Visit</TableHead>
                <TableHead className="font-semibold">Balance</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No patients found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPatients.map((patient) => (
                  <TableRow key={patient.id} className="data-table-row">
                    <TableCell className="font-medium text-primary">{patient.patient_number}</TableCell>
                    <TableCell>
                      <div className="font-medium">{patient.first_name} {patient.last_name}</div>
                      {patient.email && (
                        <div className="text-sm text-muted-foreground">{patient.email}</div>
                      )}
                    </TableCell>
                    <TableCell>{calculateAge(patient.date_of_birth)}</TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell>{patient.last_visit_date || '-'}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'font-medium',
                        patient.balance && patient.balance > 0 ? 'text-destructive' : 'text-foreground'
                      )}>
                        Rs. {(patient.balance || 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={patient.status === 'active' ? 'default' : 'secondary'}>
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openViewDialog(patient)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(patient)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(patient)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Showing {filteredPatients.length} of {patients.length} patients
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Patient Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Register New Patient' : 'Edit Patient'}</DialogTitle>
            <DialogDescription>
              {formMode === 'create' 
                ? 'Fill in the patient information below' 
                : 'Update the patient information'
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">First Name *</label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Last Name *</label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    placeholder="Enter last name"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Phone *</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="0321-1234567"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="patient@email.com"
                  />
                </div>
                <div>
                  <label className="form-label">Date of Birth</label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                  />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">Address</label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="form-label">Emergency Contact Name</label>
                  <Input
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})}
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <label className="form-label">Emergency Contact Phone</label>
                  <Input
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({...formData, emergency_contact_phone: e.target.value})}
                    placeholder="0321-1234567"
                  />
                </div>
              </div>
            </div>

            {/* Medical Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Medical Information</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="form-label">Allergies</label>
                  <Textarea
                    value={formData.allergies}
                    onChange={(e) => setFormData({...formData, allergies: e.target.value})}
                    placeholder="List any known allergies"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="form-label">Current Medications</label>
                  <Textarea
                    value={formData.current_medications}
                    onChange={(e) => setFormData({...formData, current_medications: e.target.value})}
                    placeholder="List current medications"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="form-label">Medical Conditions</label>
                  <Textarea
                    value={formData.medical_conditions}
                    onChange={(e) => setFormData({...formData, medical_conditions: e.target.value})}
                    placeholder="List any medical conditions"
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
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {formMode === 'create' ? 'Register Patient' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Patient Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Patient Profile</DialogTitle>
          </DialogHeader>
          
          {selectedPatient && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                  {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedPatient.first_name} {selectedPatient.last_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedPatient.patient_number}</p>
                  <Badge variant={selectedPatient.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                    {selectedPatient.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedPatient.phone}</span>
                </div>
                {selectedPatient.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedPatient.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Registered: {selectedPatient.registration_date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className={selectedPatient.balance && selectedPatient.balance > 0 ? 'text-destructive' : ''}>
                    Balance: Rs. {(selectedPatient.balance || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {(selectedPatient.allergies || selectedPatient.medical_conditions) && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <h4 className="font-medium text-sm">Medical Info</h4>
                  {selectedPatient.allergies && (
                    <div className="text-sm">
                      <span className="text-destructive font-medium">Allergies: </span>
                      {selectedPatient.allergies}
                    </div>
                  )}
                  {selectedPatient.medical_conditions && (
                    <div className="text-sm">
                      <span className="font-medium">Conditions: </span>
                      {selectedPatient.medical_conditions}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsViewOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setIsViewOpen(false);
                  openEditForm(selectedPatient);
                }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Patient
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setIsDeleteOpen(open);
          if (!open) setPatientToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete patient</AlertDialogTitle>
            <AlertDialogDescription>
              {patientToDelete
                ? `Are you sure you want to delete patient ${patientToDelete.first_name} ${patientToDelete.last_name}? This action cannot be undone.`
                : 'Are you sure you want to delete this patient? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting || !patientToDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDeletePatient();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
