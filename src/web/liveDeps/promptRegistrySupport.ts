const promptRegistryColumnSupport = {
  checked: false,
  hasStep: false,
  hasPromptText: false,
};

export async function ensurePromptRegistryColumns(client: any) {
  if (promptRegistryColumnSupport.checked) {
    return;
  }
  try {
    const { data, error } = await client
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'prompt_registry')
      .in('column_name', ['step', 'prompt_text']);
    if (error) {
      promptRegistryColumnSupport.hasStep = true;
      promptRegistryColumnSupport.hasPromptText = true;
      promptRegistryColumnSupport.checked = true;
      return;
    }
    const cols = (data ?? []).map((row: any) => row.column_name);
    promptRegistryColumnSupport.hasStep = cols.includes('step');
    promptRegistryColumnSupport.hasPromptText = cols.includes('prompt_text');
    promptRegistryColumnSupport.checked = true;
  } catch (err: unknown) {
    console.warn('Failed to check prompt_registry schema, assuming columns exist:', err);
    promptRegistryColumnSupport.hasStep = true;
    promptRegistryColumnSupport.hasPromptText = true;
    promptRegistryColumnSupport.checked = true;
  }
}

export function getPromptRegistryColumnSupport() {
  return promptRegistryColumnSupport;
}
