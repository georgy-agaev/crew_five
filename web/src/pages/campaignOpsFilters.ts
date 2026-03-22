import type { Campaign, CampaignCompaniesView, CampaignCompany } from '../apiClient';

export type CampaignListStatusFilter = 'all' | 'draft' | 'review' | 'ready' | 'paused';
export type CampaignListSort = 'name' | 'status';
export type CompanyResearchFilter = 'all' | 'fresh' | 'stale' | 'missing';
export type CompanySort = 'name' | 'contacts' | 'updated';

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function compareNullableStrings(left: string | null | undefined, right: string | null | undefined) {
  return normalizeText(left).localeCompare(normalizeText(right), 'ru');
}

function compareNullableNumbers(left: number | null | undefined, right: number | null | undefined) {
  return (right ?? -1) - (left ?? -1);
}

function compareNullableDates(left: string | null | undefined, right: string | null | undefined) {
  const leftTime = left ? Date.parse(left) : Number.NEGATIVE_INFINITY;
  const rightTime = right ? Date.parse(right) : Number.NEGATIVE_INFINITY;
  return rightTime - leftTime;
}

export function filterAndSortCampaigns(
  campaigns: Campaign[],
  search: string,
  statusFilter: CampaignListStatusFilter,
  sortBy: CampaignListSort
) {
  const query = normalizeText(search);
  return [...campaigns]
    .filter((campaign) => {
      if (statusFilter !== 'all' && campaign.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        normalizeText(campaign.name).includes(query) ||
        normalizeText(campaign.status).includes(query) ||
        normalizeText(campaign.segment_id).includes(query)
      );
    })
    .sort((left, right) => {
      if (sortBy === 'status') {
        const statusDiff = compareNullableStrings(left.status, right.status);
        if (statusDiff !== 0) return statusDiff;
      }
      return compareNullableStrings(left.name, right.name);
    });
}

export function filterAndSortCampaignCompanies(
  companiesView: CampaignCompaniesView | null,
  search: string,
  researchFilter: CompanyResearchFilter,
  sortBy: CompanySort
) {
  const companies = companiesView?.companies ?? [];
  const query = normalizeText(search);

  return [...companies]
    .filter((company) => {
      if (researchFilter !== 'all' && company.enrichment.status !== researchFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return campaignCompanySearchText(company).includes(query);
    })
    .sort((left, right) => {
      if (sortBy === 'contacts') {
        const contactDiff = compareNullableNumbers(left.contact_count, right.contact_count);
        if (contactDiff !== 0) return contactDiff;
      }
      if (sortBy === 'updated') {
        const dateDiff = compareNullableDates(left.enrichment.last_updated_at, right.enrichment.last_updated_at);
        if (dateDiff !== 0) return dateDiff;
      }
      return compareNullableStrings(left.company_name, right.company_name);
    });
}

export function campaignCompanySearchText(company: CampaignCompany) {
  return [
    company.company_name,
    company.website,
    company.company_description,
    company.region,
    company.office_qualification,
    company.enrichment.provider_hint,
  ]
    .map((value) => normalizeText(value))
    .join(' ');
}
