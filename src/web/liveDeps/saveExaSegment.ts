export async function saveExaSegmentToSupabase(
  supabase: any,
  payload: {
    name: string;
    locale: string;
    companies: any[];
    employees: any[];
    query: string;
    description?: string;
  }
) {
  const { data: segment, error: segmentError } = await supabase
    .from('segments')
    .insert({
      name: payload.name,
      locale: payload.locale,
      description: payload.description || `EXA Web Search: ${payload.query}`,
      filter_definition: JSON.stringify([]),
    })
    .select()
    .single();

  if (segmentError || !segment) {
    throw new Error(segmentError?.message || 'Failed to create segment');
  }

  const segmentId = segment.id as string;
  const segmentVersion = 1;
  const companyMap = new Map<string, string>();

  for (const company of payload.companies) {
    const domain = company.domain?.toLowerCase()?.trim() || null;
    const name = company.name?.trim() || 'Unknown Company';
    let companyId: string | null = null;

    if (domain) {
      const { data: existing } = await supabase
        .from('companies')
        .select('id')
        .eq('website', domain)
        .maybeSingle();
      if (existing) companyId = existing.id as string;
    }

    if (!companyId) {
      const { data: newCompany, error: insertError } = await supabase
        .from('companies')
        .insert({ company_name: name, website: domain, segment: company.industry || null, status: 'Active' })
        .select('id')
        .single();
      if (!insertError && newCompany) companyId = newCompany.id as string;
    }

    if (companyId) {
      companyMap.set(domain || name.toLowerCase(), companyId);
    }
  }

  const employeeMap = new Map<string, { employeeId: string; companyId: string }>();

  for (const employee of payload.employees) {
    const email = employee.email?.toLowerCase()?.trim() || null;
    const name = employee.name?.trim() || 'Unknown Employee';
    const role = employee.role || employee.title || null;
    const companyDomain = employee.companyDomain?.toLowerCase()?.trim() || null;
    const companyName = employee.companyName?.trim() || null;
    let companyId: string | null = null;

    if (companyDomain) {
      if (companyMap.has(companyDomain)) {
        companyId = companyMap.get(companyDomain)!;
      } else {
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('website', companyDomain)
          .maybeSingle();
        if (existing) {
          companyId = existing.id as string;
          companyMap.set(companyDomain, companyId);
        }
      }
    }

    if (!companyId && (companyName || companyDomain)) {
      const { data: newCompany, error: insertError } = await supabase
        .from('companies')
        .insert({
          company_name: companyName || companyDomain || 'Unknown Company',
          website: companyDomain,
          segment: null,
          status: 'Active',
        })
        .select('id')
        .single();

      if (!insertError && newCompany) {
        companyId = newCompany.id as string;
        if (companyDomain) companyMap.set(companyDomain, companyId);
      }
    }

    if (!companyId) continue;

    let employeeId: string | null = null;
    if (email) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('work_email', email)
        .maybeSingle();
      if (existing) employeeId = existing.id as string;
    }

    if (!employeeId) {
      const { data: newEmployee, error: insertError } = await supabase
        .from('employees')
        .insert({ company_id: companyId, full_name: name, work_email: email, position: role })
        .select('id')
        .single();
      if (!insertError && newEmployee) employeeId = newEmployee.id as string;
    }

    if (employeeId && email) {
      employeeMap.set(email, { employeeId, companyId });
    }
  }

  const segmentMembers = [...employeeMap.values()].map(({ employeeId, companyId }) => ({
    segment_id: segmentId,
    segment_version: segmentVersion,
    contact_id: employeeId,
    company_id: companyId,
    snapshot: { source: 'exa', query: payload.query },
  }));

  if (segmentMembers.length > 0) {
    const { error: membersError } = await supabase.from('segment_members').insert(segmentMembers);
    if (membersError) {
      console.error('Failed to insert segment members:', membersError);
    }
  }

  return {
    id: segmentId,
    name: payload.name,
    stats: {
      companiesProcessed: companyMap.size,
      employeesProcessed: employeeMap.size,
      segmentMembersCreated: segmentMembers.length,
    },
  };
}
