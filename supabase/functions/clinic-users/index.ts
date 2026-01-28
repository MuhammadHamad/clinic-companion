import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AppRole = 'admin' | 'dentist' | 'receptionist' | 'super_admin';

type Action = 'list' | 'create' | 'updateRole' | 'remove';

type RequestBody = {
  action: Action;
  payload?: unknown;
};

type CreatePayload = {
  email: string;
  password: string;
  role: Exclude<AppRole, 'super_admin'>;
};

type UpdateRolePayload = {
  userId: string;
  role: Exclude<AppRole, 'super_admin'>;
};

type RemovePayload = {
  userId: string;
};

const safeAudit = async (
  adminClient: ReturnType<typeof createClient>,
  params: {
    clinicId: string;
    actorUserId: string;
    action: 'create_user' | 'attach_user' | 'update_role' | 'remove_user';
    targetUserId?: string | null;
    oldRole?: string | null;
    newRole?: string | null;
    targetEmail?: string | null;
    metadata?: Record<string, unknown>;
  },
) => {
  try {
    const res = await adminClient.rpc('log_user_management_event', {
      p_clinic_id: params.clinicId,
      p_actor_user_id: params.actorUserId,
      p_action: params.action,
      p_target_user_id: params.targetUserId ?? null,
      p_old_role: params.oldRole ?? null,
      p_new_role: params.newRole ?? null,
      p_target_email: params.targetEmail ?? null,
      p_metadata: params.metadata ?? {},
    });
    if (res.error) {
      console.error('audit_log_failed', {
        message: res.error.message,
        action: params.action,
        clinicId: params.clinicId,
        actorUserId: params.actorUserId,
        targetUserId: params.targetUserId ?? null,
      });
    }
  } catch (e) {
    console.error('audit_log_exception', {
      action: params.action,
      clinicId: params.clinicId,
      actorUserId: params.actorUserId,
      targetUserId: params.targetUserId ?? null,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};

const json = (status: number, data: unknown) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
};

const getBearerToken = (req: Request): string | null => {
  const auth = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length !== 2) return null;
  if (parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1] || null;
};

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl =
    Deno.env.get('EDGE_SUPABASE_URL') ||
    Deno.env.get('SUPABASE_URL') ||
    Deno.env.get('SB_URL');
  const serviceRoleKey =
    Deno.env.get('EDGE_SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SB_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, {
      error: 'Missing server configuration',
      missing: {
        supabaseUrl: !supabaseUrl,
        serviceRoleKey: !serviceRoleKey,
      },
      expectedEnv: {
        supabaseUrl: ['EDGE_SUPABASE_URL', 'SUPABASE_URL'],
        serviceRoleKey: ['EDGE_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      },
    });
  }

  const token = getBearerToken(req);
  if (!token) {
    return json(401, { error: 'Missing Authorization header' });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  if (!body?.action) {
    return json(400, { error: 'Missing action' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const userRes = await adminClient.auth.getUser(token);
  if (userRes.error || !userRes.data?.user) {
    return json(401, { error: userRes.error?.message || 'Invalid session' });
  }

  const callerId = userRes.data.user.id;

  const callerRoleRes = await adminClient
    .from('user_roles')
    .select('role, clinic_id')
    .eq('user_id', callerId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (callerRoleRes.error) {
    return json(500, { error: callerRoleRes.error.message || 'Failed to load role' });
  }

  const callerRow = (callerRoleRes.data || [])[0] as { role?: AppRole; clinic_id?: string | null } | undefined;
  const callerRole = callerRow?.role || null;
  const clinicId = callerRow?.clinic_id || null;

  if (callerRole !== 'admin' || !clinicId) {
    return json(403, { error: 'Not authorized' });
  }

  if (body.action === 'list') {
    const usersRes = await adminClient.rpc('list_clinic_users', { p_clinic_id: clinicId });

    if (usersRes.error) {
      return json(500, { error: usersRes.error.message || 'Failed to load users' });
    }

    const users = (usersRes.data || []).map((u: any) => {
      return {
        user_id: u.user_id,
        role: u.role,
        created_at: u.created_at,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
      };
    });

    return json(200, { clinicId, users });
  }

  if (body.action === 'create') {
    const payload = body.payload as CreatePayload;

    if (!payload || !isNonEmptyString(payload.email) || !isNonEmptyString(payload.password) || !isNonEmptyString(payload.role)) {
      return json(400, { error: 'Invalid payload' });
    }

    if (!['admin', 'dentist', 'receptionist'].includes(payload.role)) {
      return json(400, { error: 'Invalid role' });
    }

    const countRes = await adminClient
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .neq('role', 'super_admin');

    if (countRes.error) {
      return json(500, { error: countRes.error.message || 'Failed to validate limit' });
    }

    if ((countRes.count || 0) >= 3) {
      return json(400, { error: 'Clinic user limit reached (max 3 users per clinic).' });
    }

    if (payload.role === 'admin') {
      const adminCountRes = await adminClient
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('role', 'admin');

      if (adminCountRes.error) {
        return json(500, { error: adminCountRes.error.message || 'Failed to validate admin limit' });
      }

      if ((adminCountRes.count || 0) >= 1) {
        return json(400, { error: 'Only 1 admin is allowed per clinic.' });
      }
    }

    const normalizedEmail = payload.email.trim();

    const created = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: payload.password,
      email_confirm: true,
      user_metadata: {},
    });

    const createdNew = !created.error && Boolean(created.data?.user);

    let userId: string | null = created.data?.user?.id || null;
    if (!userId) {
      const lookup = await adminClient.rpc('get_auth_user_id_by_email', { p_email: normalizedEmail });
      if (lookup.error) {
        return json(500, { error: lookup.error.message || 'Failed to lookup user' });
      }
      userId = lookup.data || null;
    }

    if (!userId) {
      return json(400, { error: created.error?.message || 'Failed to create user' });
    }

    void safeAudit(adminClient, {
      clinicId,
      actorUserId: callerId,
      action: 'create_user',
      targetUserId: userId,
      targetEmail: normalizedEmail,
      metadata: { createdNew },
    });

    const attached = await adminClient.rpc('attach_user_to_clinic', {
      p_user_id: userId,
      p_clinic_id: clinicId,
      p_role: payload.role,
    });

    if (attached.error) {
      if (createdNew) {
        await adminClient.auth.admin.deleteUser(userId);
      }
      return json(400, { error: attached.error.message || 'Failed to assign role' });
    }

    const row = (attached.data || [])[0] as { user_id: string; role: AppRole; clinic_id: string | null } | undefined;
    if (!row) {
      if (createdNew) {
        await adminClient.auth.admin.deleteUser(userId);
      }
      return json(500, { error: 'Failed to assign role' });
    }

    void safeAudit(adminClient, {
      clinicId,
      actorUserId: callerId,
      action: 'attach_user',
      targetUserId: row.user_id,
      newRole: row.role,
      targetEmail: normalizedEmail,
    });

    return json(200, { user_id: row.user_id, role: row.role, clinic_id: row.clinic_id });
  }

  if (body.action === 'updateRole') {
    const payload = body.payload as UpdateRolePayload;

    if (!payload || !isNonEmptyString(payload.userId) || !isNonEmptyString(payload.role)) {
      return json(400, { error: 'Invalid payload' });
    }

    if (payload.userId === callerId) {
      return json(400, { error: 'You cannot change your own role.' });
    }

    if (!['admin', 'dentist', 'receptionist'].includes(payload.role)) {
      return json(400, { error: 'Invalid role' });
    }

    const existing = await adminClient
      .from('user_roles')
      .select('user_id, role, clinic_id')
      .eq('user_id', payload.userId)
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (existing.error) {
      return json(400, { error: existing.error.message || 'Failed to lookup user' });
    }

    if (!existing.data) {
      return json(404, { error: 'User not found in your clinic' });
    }

    const oldRole = existing.data.role as string;

    const updated = await adminClient
      .from('user_roles')
      .update({ role: payload.role })
      .eq('user_id', payload.userId)
      .eq('clinic_id', clinicId)
      .select('user_id, role, clinic_id')
      .single();

    if (updated.error) {
      return json(400, { error: updated.error.message || 'Failed to update role' });
    }

    void safeAudit(adminClient, {
      clinicId,
      actorUserId: callerId,
      action: 'update_role',
      targetUserId: payload.userId,
      oldRole,
      newRole: payload.role,
    });

    return json(200, updated.data);
  }

  if (body.action === 'remove') {
    const payload = body.payload as RemovePayload;

    if (!payload || !isNonEmptyString(payload.userId)) {
      return json(400, { error: 'Invalid payload' });
    }

    if (payload.userId === callerId) {
      return json(400, { error: 'You cannot remove your own access.' });
    }

    const existing = await adminClient
      .from('user_roles')
      .select('user_id, role, clinic_id')
      .eq('user_id', payload.userId)
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (existing.error) {
      return json(400, { error: existing.error.message || 'Failed to lookup user' });
    }

    if (!existing.data) {
      return json(404, { error: 'User not found in your clinic' });
    }

    const detached = await adminClient.rpc('detach_user_from_clinic', {
      p_user_id: payload.userId,
      p_clinic_id: clinicId,
    });

    if (detached.error) {
      return json(400, { error: detached.error.message || 'Failed to remove user' });
    }

    if (!detached.data) {
      return json(404, { error: 'User not found in your clinic' });
    }

    void safeAudit(adminClient, {
      clinicId,
      actorUserId: callerId,
      action: 'remove_user',
      targetUserId: payload.userId,
      oldRole: existing.data.role as string,
    });

    return json(200, { ok: true });
  }

  return json(400, { error: 'Unknown action' });
});
