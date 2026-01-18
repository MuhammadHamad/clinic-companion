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

interface RestorePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient | null;
  isRestoring: boolean;
  onConfirm: () => void;
}

export function RestorePatientDialog({
  open,
  onOpenChange,
  patient,
  isRestoring,
  onConfirm,
}: RestorePatientDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(openState) => {
        if (isRestoring) return;
        onOpenChange(openState);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore Customer</AlertDialogTitle>
          <AlertDialogDescription>
            {patient
              ? `Are you sure you want to restore customer ${patient.first_name} ${patient.last_name}? The customer will be moved back to active status.`
              : 'Are you sure you want to restore this customer?'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isRestoring || !patient}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isRestoring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restoring...
              </>
            ) : (
              'Restore Customer'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
