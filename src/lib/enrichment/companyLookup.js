import { searchCompanyApi, getCompanyDetailsApi } from '../api';

export async function searchCompany(companyName) {
  if (!companyName || companyName.length < 3) return null;

  try {
    const data = await searchCompanyApi(companyName);
    if (!data) return { error: 'api_error', message: 'API request failed' };

    const companies = data.results?.companies || [];

    return {
      results: companies.map((c) => ({
        name: c.company?.name,
        company_number: c.company?.company_number,
        jurisdiction: c.company?.jurisdiction_code?.toUpperCase(),
        incorporation_date: c.company?.incorporation_date,
        status: c.company?.current_status,
        registered_address: c.company?.registered_address_in_full,
        type: c.company?.company_type,
        opencorporates_url: c.company?.opencorporates_url,
        source: 'OpenCorporates',
      })),
      total: data.total_count || companies.length,
    };
  } catch (err) {
    return { error: 'network_error', message: err.message };
  }
}

export async function getCompanyDetails(jurisdictionCode, companyNumber) {
  try {
    const data = await getCompanyDetailsApi(jurisdictionCode, companyNumber);
    if (!data) return null;

    const company = data.results?.company;
    if (!company) return null;

    return {
      name: company.name,
      company_number: company.company_number,
      jurisdiction: company.jurisdiction_code?.toUpperCase(),
      incorporation_date: company.incorporation_date,
      dissolution_date: company.dissolution_date,
      status: company.current_status,
      type: company.company_type,
      registered_address: company.registered_address_in_full,
      agent_name: company.agent_name,
      officers: (company.officers || []).map((o) => ({
        name: o.officer?.name,
        position: o.officer?.position,
        start_date: o.officer?.start_date,
        end_date: o.officer?.end_date,
      })),
      opencorporates_url: company.opencorporates_url,
      source: 'OpenCorporates',
    };
  } catch (err) {
    return null;
  }
}
