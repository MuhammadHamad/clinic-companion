import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Patient } from '@/types';

interface DuplicatePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicatePatient: Patient | null;
  onViewExisting: () => void;
  onCreateAnyway: () => void;
}

export function DuplicatePatientDialog({
  open,
  onOpenChange,
  duplicatePatient,
  onViewExisting,
  onCreateAnyway,
}: DuplicatePatientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Possible Duplicate Customer</DialogTitle>
          <DialogDescription>
            A customer with this phone number already exists in the system.
          </DialogDescription>
        </DialogHeader>

        {duplicatePatient && (
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="font-medium">
              {duplicatePatient.first_name} {duplicatePatient.last_name}
            </p>
            <p className="text-sm text-muted-foreground">{duplicatePatient.phone}</p>
            <p className="text-sm text-muted-foreground">
              Customer #{duplicatePatient.patient_number}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onViewExisting}>
            View Existing
          </Button>
          <Button onClick={onCreateAnyway}>Create Anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
