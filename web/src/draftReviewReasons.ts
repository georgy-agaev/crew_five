export const draftReviewReasonOptions = [
  { code: 'too_generic', label: 'Too generic', description: 'The copy feels broad and could fit almost any company.' },
  { code: 'marketing_tone', label: 'Marketing tone', description: 'The message reads like an ad instead of operator outreach.' },
  { code: 'bad_subject', label: 'Bad subject', description: 'The subject line looks promotional or low-trust.' },
  { code: 'wrong_narrative', label: 'Wrong narrative', description: 'The draft leans on a false or weak premise.' },
  { code: 'gender_mismatch', label: 'Gender mismatch', description: 'Sender phrasing does not match the sender gender.' },
  { code: 'explicit_title', label: 'Explicit title', description: 'The recipient title is used too literally in the copy.' },
  { code: 'unnatural_russian', label: 'Unnatural Russian', description: 'The Russian phrasing sounds unnatural or translated.' },
  { code: 'fabricated_context', label: 'Fabricated context', description: 'The draft invents facts about the company or situation.' },
  {
    code: 'weak_personalization',
    label: 'Weak personalization',
    description: 'The personalization is too shallow to feel specific.',
  },
  { code: 'bad_cta', label: 'Bad CTA', description: 'The call to action is weak, vague, or too pushy.' },
  { code: 'wrong_persona', label: 'Wrong persona', description: 'The angle does not fit the recipient role.' },
  { code: 'tone_mismatch', label: 'Tone mismatch', description: 'The tone is wrong for the target account or sender.' },
  { code: 'factual_issue', label: 'Factual issue', description: 'There is a factual error in the draft.' },
  { code: 'duplicate', label: 'Duplicate', description: 'The draft duplicates another message in the same batch.' },
  { code: 'other', label: 'Other', description: 'Use free text to explain the rejection.' },
] as const;

export type DraftReviewReasonCode = (typeof draftReviewReasonOptions)[number]['code'];

export const draftReviewReasonCodes = draftReviewReasonOptions.map((option) => option.code);

export function isDraftReviewReasonCode(value: unknown): value is DraftReviewReasonCode {
  return typeof value === 'string' && draftReviewReasonCodes.includes(value as DraftReviewReasonCode);
}

export function getDraftReviewReasonLabel(code: string | null | undefined) {
  const option = draftReviewReasonOptions.find((candidate) => candidate.code === code);
  return option?.label ?? null;
}
