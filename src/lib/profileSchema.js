export const EMPTY_PROFILE = {
  identity: {
    full_name: '',
    aliases: [],
    date_of_birth: '',
    age: null,
    nationality: '',
    gender: '',
    photo_url: '',
  },

  professional: {
    title: '',
    organization: '',
    organization_type: '',
    industry: '',
    annual_revenue: '',
    previous_roles: [],
    education: [],
    professional_licenses: [],
  },

  locations: {
    addresses: [],
  },

  contact: {
    phone_numbers: [],
    email_addresses: [],
  },

  digital: {
    social_accounts: [],
    data_broker_listings: [],
    domain_registrations: [],
  },

  breaches: {
    records: [],
  },

  network: {
    family_members: [],
    associates: [],
  },

  public_records: {
    properties: [],
    corporate_filings: [],
    court_records: [],
    political_donations: [],
    other: [],
  },

  behavioral: {
    routines: [],
    travel_patterns: [],
    digital_behavior: [],
    observations: [],
  },

  notes: {
    general: '',
    raw_sources: [],
  },
};

export const ADDRESS_TYPES = ['home', 'work', 'vacation', 'secondary', 'previous'];
export const PHONE_TYPES = ['personal', 'work', 'burner'];
export const EMAIL_TYPES = ['personal', 'work', 'legacy'];
export const CONFIDENCE_LEVELS = ['confirmed', 'probable', 'unverified'];
export const VISIBILITY_OPTIONS = ['public', 'private', 'friends_only', 'semi_public'];
export const SEVERITY_LEVELS = ['high', 'medium', 'low'];
export const RELATIONSHIP_TYPES = ['Spouse', 'Child', 'Parent', 'Sibling', 'Extended Family', 'Other'];
export const BROKER_STATUSES = ['active', 'removed', 'pending_removal'];

export const SOCIAL_PLATFORMS = [
  'LinkedIn', 'Twitter/X', 'Facebook', 'Instagram', 'TikTok',
  'Snapchat', 'Reddit', 'YouTube', 'Strava', 'Venmo',
  'WhatsApp', 'Telegram', 'Signal', 'Other',
];
