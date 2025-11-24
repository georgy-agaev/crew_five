export interface DraftForJudge {
  id: string;
  subject: string;
  body: string;
}

export interface DraftScore {
  quality: number;
  tone: number;
  safety: number;
  reason: string;
}

export async function scoreDraft(_draft: DraftForJudge): Promise<DraftScore> {
  return {
    quality: 0.8,
    tone: 0.7,
    safety: 0.9,
    reason: 'stub-score',
  };
}

export async function recordJudgement(client: any, draftId: string, score: DraftScore) {
  const { error } = await client.from('drafts').update({ score }).eq('id', draftId);
  if (error) throw error;
}
