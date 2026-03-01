const BROKER_CONFIGS = [
  {
    name: 'Spokeo',
    searchUrl: (firstName, lastName, state) =>
      `https://www.spokeo.com/${firstName}-${lastName}/${state}`,
    notes: 'Major aggregator — shows name, address, phone, relatives, email',
  },
  {
    name: 'WhitePages',
    searchUrl: (firstName, lastName, state) =>
      `https://www.whitepages.com/name/${firstName}-${lastName}/${state}`,
    notes: 'Phone-focused — shows phone numbers, addresses, associates',
  },
  {
    name: 'BeenVerified',
    searchUrl: (firstName, lastName, state) =>
      `https://www.beenverified.com/people/${firstName}-${lastName}/${state}/`,
    notes: 'Comprehensive — shows addresses, phones, emails, court records',
  },
  {
    name: 'TruePeopleSearch',
    searchUrl: (firstName, lastName, state) =>
      `https://www.truepeoplesearch.com/results?name=${firstName}%20${lastName}&citystatezip=${state}`,
    notes: 'Free results — shows name, address, phone, relatives',
  },
  {
    name: 'FastPeopleSearch',
    searchUrl: (firstName, lastName, state) =>
      `https://www.fastpeoplesearch.com/name/${firstName}-${lastName}_${state}`,
    notes: 'Free results — shows address, phone, email, relatives',
  },
  {
    name: 'Radaris',
    searchUrl: (firstName, lastName, state) =>
      `https://radaris.com/p/${firstName}/${lastName}/${state}/`,
    notes: 'Shows addresses, phones, public records, social profiles',
  },
  {
    name: 'ThatsThem',
    searchUrl: (firstName, lastName, state) =>
      `https://thatsthem.com/name/${firstName}-${lastName}/${state}`,
    notes: 'Shows address, phone, email, IP addresses',
  },
  {
    name: 'PeopleFinder',
    searchUrl: (firstName, lastName, state) =>
      `https://www.peoplefinder.com/results.php?name=${firstName}+${lastName}&location=${state}`,
    notes: 'Shows addresses, phone numbers, relatives',
  },
];

export function generateBrokerCheckUrls(fullName, state) {
  if (!fullName || !state) return [];

  const nameParts = fullName.replace(/\b\w\.\s*/g, '').trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];

  if (!firstName || !lastName) return [];

  return BROKER_CONFIGS.map((broker) => ({
    name: broker.name,
    url: broker.searchUrl(firstName.toLowerCase(), lastName.toLowerCase(), state.toLowerCase()),
    notes: broker.notes,
    status: 'unchecked',
  }));
}
