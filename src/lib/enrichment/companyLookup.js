import { searchCompanyApi, getCompanyDetailsApi } from '../api';

export async function searchCompany(companyName) {
  if (!companyName || companyName.length < 3) return null;

  try {
    const data = await searchCompanyApi(companyName);
    if (!data) return { error: 'api_error', message: 'API request failed' };

    const companies = data.results || [];

    return {
      results: companies.map((c) => ({
        name: c.name,
        cik: c.cik,
        ticker: c.ticker,
        source: 'SEC EDGAR',
      })),
      total: companies.length,
    };
  } catch (err) {
    return { error: 'network_error', message: err.message };
  }
}

export async function getCompanyDetails(cik) {
  try {
    const data = await getCompanyDetailsApi(cik);
    if (!data) return null;

    const recentFilings = (data.filings?.recent?.form || []).slice(0, 10).map((form, i) => ({
      form,
      date: data.filings.recent.filingDate?.[i],
      accession: data.filings.recent.accessionNumber?.[i],
      description: data.filings.recent.primaryDocDescription?.[i],
    }));

    return {
      name: data.name,
      cik: data.cik,
      ticker: data.tickers?.[0] || null,
      sic_description: data.sicDescription || null,
      sic: data.sic || null,
      state: data.stateOfIncorporation || data.addresses?.business?.stateOrCountry || null,
      fiscal_year_end: data.fiscalYearEnd || null,
      exchanges: data.exchanges || [],
      entity_type: data.entityType || null,
      ein: data.ein || null,
      recent_filings: recentFilings,
      source: 'SEC EDGAR',
    };
  } catch (err) {
    return null;
  }
}
