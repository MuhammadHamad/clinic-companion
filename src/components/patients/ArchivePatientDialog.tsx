import { Loader2 } from 'lucide-react';
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
import { Patient } from '@/types';

interface ArchivePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient | null;
  isArchiving: boolean;
  onConfirm: () => void;
}

export function ArchivePatientDialog({
  open,
  onOpenChange,
  patient,
  isArchiving,
  onConfirm,
}: ArchivePatientDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(openState) => {
        if (isArchiving) return;
        onOpenChange(openState);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Customer</AlertDialogTitle>
          <AlertDialogDescription>
            {patient
              ? `Are you sure you want to archive customer ${patient.first_name} ${patient.last_name}? The customer will be moved to the archived section and can be restored later.`
              : 'Are you sure you want to archive this customer? The customer will be moved to the archived section and can be restored later.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isArchiving || !patient}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isArchiving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Archiving...
              </>
            ) : (
              'Archive Customer'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
