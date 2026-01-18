import { Eye, Pencil, ArchiveRestore, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Patient } from '@/types';
import { cn } from '@/lib/utils';

interface InvoiceSummary {
  balance: number;
  lastVisit: string | null;
}

interface PatientsTableProps {
  patients: Patient[];
  totalPatients: number;
  invoiceSummaries: Record<string, InvoiceSummary>;
  onView: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  onArchive: (patient: Patient) => void;
  onRestore: (patient: Patient) => void;
}

function calculateAge(dateOfBirth?: string): string | number {
  if (!dateOfBirth) return '-';
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function PatientsTable({
  patients,
  totalPatients,
  invoiceSummaries,
  onView,
  onEdit,
  onArchive,
  onRestore,
}: PatientsTableProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold whitespace-nowrap">Customer #</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Name</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Age</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Phone</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Last Visit</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Balance</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
              <TableHead className="font-semibold text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {totalPatients === 0 ? 'No customers found' : 'No customers on this page'}
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => {
                const summary = invoiceSummaries[patient.id];
                const lastVisit = summary?.lastVisit || patient.last_visit_date || '-';
                const balance = summary ? summary.balance : (patient.balance || 0);

                return (
                  <TableRow key={patient.id} className="data-table-row">
                    <TableCell className="font-medium text-primary">{patient.patient_number}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => onView(patient)}
                        className="font-medium text-primary hover:underline text-left"
                      >
                        {patient.first_name} {patient.last_name}
                      </button>
                      {patient.email && (
                        <div className="text-sm text-muted-foreground">{patient.email}</div>
                      )}
                    </TableCell>
                    <TableCell>{calculateAge(patient.date_of_birth)}</TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell>{lastVisit}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'font-medium',
                          balance > 0 ? 'text-destructive' : 'text-foreground'
                        )}
                      >
                        Rs. {balance.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          patient.status === 'active'
                            ? 'default'
                            : patient.status === 'archived'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => onView(patient)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(patient)}
                              disabled={patient.status === 'archived'}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit</p>
                          </TooltipContent>
                        </Tooltip>
                        {patient.status === 'archived' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => onRestore(patient)}>
                                <ArchiveRestore className="h-4 w-4 text-green-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Restore</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => onArchive(patient)}>
                                <Archive className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Archive</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
