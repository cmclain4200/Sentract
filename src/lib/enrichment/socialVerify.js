export async function verifySocialProfile(platform, handle) {
  const normalizedPlatform = platform.toLowerCase().trim();

  switch (normalizedPlatform) {
    case 'github':
      return verifyGitHub(handle);
    case 'linkedin':
      return manualVerify('LinkedIn', handle, 'linkedin');
    case 'twitter':
    case 'x':
      return manualVerify('Twitter/X', handle, 'twitter');
    case 'instagram':
      return manualVerify('Instagram', handle, 'instagram');
    case 'facebook':
      return manualVerify('Facebook', handle, 'facebook');
    case 'tiktok':
      return manualVerify('TikTok', handle, 'tiktok');
    case 'strava':
      return manualVerify('Strava', handle, 'strava');
    default:
      return { verified: false, reason: 'Platform not supported for verification' };
  }
}

async function verifyGitHub(handle) {
  try {
    const cleanHandle = handle
      .replace(/^@/, '')
      .replace(/https?:\/\/github\.com\//i, '')
      .split('/')[0];
    const response = await fetch(`https://api.github.com/users/${cleanHandle}`);

    if (response.status === 404) return { verified: false, reason: 'Profile not found' };
    if (!response.ok) return { verified: false, reason: 'Lookup failed' };

    const data = await response.json();
    return {
      verified: true,
      platform: 'GitHub',
      handle: data.login,
      url: data.html_url,
      display_name: data.name,
      bio: data.bio,
      followers: data.followers,
      following: data.following,
      public_repos: data.public_repos,
      created: data.created_at,
      visibility: 'public',
      metadata: {
        company: data.company,
        location: data.location,
        blog: data.blog,
      },
      source: 'GitHub API',
    };
  } catch (err) {
    return { verified: false, reason: err.message };
  }
}

function generateVerificationUrl(platform, handle) {
  const cleanHandle = handle.replace(/^@/, '');

  const urls = {
    linkedin: `https://www.linkedin.com/in/${cleanHandle}`,
    twitter: `https://twitter.com/${cleanHandle}`,
    x: `https://x.com/${cleanHandle}`,
    instagram: `https://www.instagram.com/${cleanHandle}/`,
    facebook: `https://www.facebook.com/${cleanHandle}`,
    tiktok: `https://www.tiktok.com/@${cleanHandle}`,
    strava: `https://www.strava.com/athletes/${cleanHandle}`,
  };

  return urls[platform.toLowerCase()] || null;
}

const PLATFORM_INSTRUCTIONS = {
  linkedin: 'Open profile link to verify. Note: follower count, headline, and public visibility.',
  twitter: 'Open profile link to verify. Note: follower count, bio, join date, and whether tweets are protected.',
  instagram: 'Open profile link to verify. Note: follower count, post count, bio, and whether account is private.',
  facebook: 'Open profile link to verify. Note: public visibility and available information.',
  tiktok: 'Open profile link to verify. Note: follower count, video count, bio.',
  strava: 'Open profile link to verify. CRITICAL: Check if activities are public — this exposes GPS routes and schedules.',
};

function manualVerify(displayName, handle, platformKey) {
  const url = generateVerificationUrl(platformKey, handle);
  return {
    verified: null,
    platform: displayName,
    url,
    manual_check: true,
    instructions: PLATFORM_INSTRUCTIONS[platformKey] || 'Open profile link to verify.',
  };
}
