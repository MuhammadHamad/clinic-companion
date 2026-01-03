import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type ClinicRow = {
  id: string;
  name: string;
  slug?: string | null;
  created_at?: string | null;
};

export default function SaasClinics() {
  const { toast } = useToast();
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '' });
  const [setupWarning, setSetupWarning] = useState<string | null>(null);

  const fetchClinics = async () => {
    setIsLoading(true);
    setSetupWarning(null);

    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, slug, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setClinics([]);
      setSetupWarning('Clinics table is not accessible yet (missing table or RLS policy).');
    } else {
      setClinics((data || []) as ClinicRow[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createClinic = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast({
        title: 'Validation error',
        description: 'Clinic name and slug are required',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('clinics').insert({
      name: form.name.trim(),
      slug: form.slug.trim(),
    });

    if (error) {
      toast({
        title: 'Failed to create clinic',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Clinic created',
      description: 'Clinic has been added successfully',
    });

    setIsDialogOpen(false);
    setForm({ name: '', slug: '' });
    fetchClinics();
  };

  return (
    <div className="min-h-screen">
      <Header title="Clinics" subtitle="Manage clinics (MVP)" />

      <div className="p-6 space-y-6 animate-fade-in">
        {setupWarning && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Setup required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>{setupWarning}</div>
              <div>
                Next step: we will add the multi-clinic schema (clinics table + RLS) so this page becomes fully functional.
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${clinics.length} clinic(s)`}
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add Clinic</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create clinic</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="form-label">Clinic Name</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Slug</label>
                  <Input
                    placeholder="e.g. smile-dental"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={createClinic}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clinics</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clinics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No clinics found
                    </TableCell>
                  </TableRow>
                ) : (
                  clinics.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.slug || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
