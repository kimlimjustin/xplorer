/**
 * GitHub Sponsors integration — auto-checks if a user sponsors kimlimjustin.
 *
 * Uses the GitHub GraphQL API with a PAT to query sponsor status.
 * Falls back gracefully if the token is not configured.
 */

const GITHUB_SPONSOR_LOGIN = 'kimlimjustin';

interface SponsorTier {
  monthlyPriceInDollars: number;
  name: string;
  isOneTime: boolean;
}

export interface SponsorStatus {
  isSponsor: boolean;
  tier: SponsorTier | null;
}

/**
 * Check if a GitHub user is currently sponsoring kimlimjustin.
 * Returns { isSponsor: true, tier } if they are, { isSponsor: false } otherwise.
 *
 * Requires GITHUB_PAT env var with `read:org` or `read:user` scope.
 */
export async function checkSponsorStatus(username: string): Promise<SponsorStatus> {
  const token = process.env.GITHUB_PAT;
  if (!token) {
    console.warn('[Sponsors] GITHUB_PAT not set — sponsor checking disabled');
    return { isSponsor: false, tier: null };
  }

  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query($sponsor: String!) {
            user(login: "${GITHUB_SPONSOR_LOGIN}") {
              isSponsoredBy(accountLogin: $sponsor)
              sponsorshipsAsMaintainer(first: 100, activeOnly: true) {
                nodes {
                  sponsorEntity {
                    ... on User { login }
                    ... on Organization { login }
                  }
                  tier {
                    monthlyPriceInDollars
                    name
                    isOneTime
                  }
                }
              }
            }
          }
        `,
        variables: { sponsor: username },
      }),
      // Cache for 5 minutes to avoid hammering the API
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error('[Sponsors] GitHub API error:', res.status, await res.text());
      return { isSponsor: false, tier: null };
    }

    const json = await res.json();
    const user = json.data?.user;

    if (!user) {
      return { isSponsor: false, tier: null };
    }

    // Check via isSponsoredBy (most reliable)
    if (user.isSponsoredBy) {
      // Find the specific tier
      const sponsorship = user.sponsorshipsAsMaintainer?.nodes?.find(
        (n: any) => n.sponsorEntity?.login?.toLowerCase() === username.toLowerCase(),
      );

      return {
        isSponsor: true,
        tier: sponsorship?.tier ?? null,
      };
    }

    return { isSponsor: false, tier: null };
  } catch (err) {
    console.error('[Sponsors] Failed to check sponsor status:', err);
    return { isSponsor: false, tier: null };
  }
}

/**
 * Determine the subscription tier from sponsor status.
 * Any active sponsor (recurring or one-time) gets PRO.
 */
export function tierFromSponsor(status: SponsorStatus): 'FREE' | 'PRO' {
  return status.isSponsor ? 'PRO' : 'FREE';
}
