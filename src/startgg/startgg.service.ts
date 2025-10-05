import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface StartggTournament {
  id: number;
  name: string;
  slug: string;
  startAt: number;
  endAt: number;
  numAttendees: number;
  events: StartggEvent[];
  url: string;
  venueAddress: string;
  city: string;
  countryCode: string;
}

export interface StartggEvent {
  id: number;
  name: string;
  slug: string;
  numEntrants: number;
  startAt: number;
  state: string;
  videogame: {
    id: number;
    name: string;
  };
  phases: StartggPhase[];
}

export interface StartggPhase {
  id: number;
  name: string;
  numSeeds: number;
  bracketType: string;
  state: number;
}

export interface StartggSet {
  id: number;
  fullRoundText: string;
  round: number;
  winnerId: number;
  slots: StartggSlot[];
  phaseGroup: {
    id: number;
    phase: {
      id: number;
      name: string;
    };
  };
}

export interface StartggSlot {
  id: number;
  entrant: {
    id: number;
    name: string;
    participants: StartggParticipant[];
  };
  standing: {
    stats: {
      score: {
        value: number;
      };
    };
  };
}

export interface StartggParticipant {
  id: number;
  gamerTag: string;
  user: {
    id: number;
    slug: string;
  };
}

@Injectable()
export class StartggService {
  private readonly logger = new Logger(StartggService.name);
  private readonly apiUrl = 'https://api.start.gg/gql/alpha';
  private readonly apiToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiToken = this.configService.get<string>('STARTGG_API_TOKEN');
    if (!this.apiToken) {
      this.logger.warn('Start.gg API token not configured');
    }
  }

  private async makeGraphQLRequest(query: string, variables: any = {}): Promise<any> {
    if (!this.apiToken) {
      throw new HttpException(
        'Start.gg API token not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            query,
            variables,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const responseData = response.data as any;

      if (responseData.errors) {
        this.logger.error('GraphQL errors:', responseData.errors);
        throw new HttpException(
          `Start.gg API error: ${responseData.errors[0].message}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return responseData.data;
    } catch (error) {
      this.logger.error('Start.gg API request failed:', error.message);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to communicate with Start.gg API',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async getTournament(slug: string): Promise<StartggTournament> {
    const query = `
      query TournamentQuery($slug: String!) {
        tournament(slug: $slug) {
          id
          name
          slug
          startAt
          endAt
          numAttendees
          url
          venueAddress
          city
          countryCode
          events {
            id
            name
            slug
            numEntrants
            startAt
            state
            videogame {
              id
              name
            }
            phases {
              id
              name
              numSeeds
              bracketType
              state
            }
          }
        }
      }
    `;

    const data = await this.makeGraphQLRequest(query, { slug });
    return data.tournament;
  }

  async getEvent(eventSlug: string): Promise<StartggEvent> {
    const query = `
      query EventQuery($slug: String!) {
        event(slug: $slug) {
          id
          name
          slug
          numEntrants
          startAt
          state
          videogame {
            id
            name
          }
          phases {
            id
            name
            numSeeds
            bracketType
            state
          }
        }
      }
    `;

    const data = await this.makeGraphQLRequest(query, { slug: eventSlug });
    return data.event;
  }

  async getEventSets(
    eventSlug: string,
    page: number = 1,
    perPage: number = 50,
  ): Promise<{ sets: StartggSet[]; pageInfo: any }> {
    const query = `
      query EventSetsQuery($slug: String!, $page: Int!, $perPage: Int!) {
        event(slug: $slug) {
          sets(page: $page, perPage: $perPage) {
            pageInfo {
              page
              perPage
              totalPages
              total
            }
            nodes {
              id
              fullRoundText
              round
              winnerId
              slots {
                id
                entrant {
                  id
                  name
                  participants {
                    id
                    gamerTag
                    user {
                      id
                      slug
                    }
                  }
                }
                standing {
                  stats {
                    score {
                      value
                    }
                  }
                }
              }
              phaseGroup {
                id
                phase {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.makeGraphQLRequest(query, {
      slug: eventSlug,
      page,
      perPage,
    });

    return {
      sets: data.event.sets.nodes,
      pageInfo: data.event.sets.pageInfo,
    };
  }

  async searchTournaments(
    query: string,
    page: number = 1,
    perPage: number = 20,
  ): Promise<{ tournaments: StartggTournament[]; pageInfo: any }> {
    const searchQuery = `
      query TournamentSearchQuery($query: String!, $page: Int!, $perPage: Int!) {
        tournaments(query: {
          page: $page
          perPage: $perPage
          filter: {
            name: $query
          }
        }) {
          pageInfo {
            page
            perPage
            totalPages
            total
          }
          nodes {
            id
            name
            slug
            startAt
            endAt
            numAttendees
            url
            venueAddress
            city
            countryCode
            events {
              id
              name
              slug
              numEntrants
              videogame {
                id
                name
              }
            }
          }
        }
      }
    `;

    const data = await this.makeGraphQLRequest(searchQuery, {
      query,
      page,
      perPage,
    });

    return {
      tournaments: data.tournaments.nodes,
      pageInfo: data.tournaments.pageInfo,
    };
  }

  async getUpcomingTournaments(
    page: number = 1,
    perPage: number = 20,
  ): Promise<{ tournaments: StartggTournament[]; pageInfo: any }> {
    const now = Math.floor(Date.now() / 1000);
    const query = `
      query UpcomingTournamentsQuery($page: Int!, $perPage: Int!, $afterDate: Timestamp!) {
        tournaments(query: {
          page: $page
          perPage: $perPage
          filter: {
            afterDate: $afterDate
          }
          sortBy: "startAt asc"
        }) {
          pageInfo {
            page
            perPage
            totalPages
            total
          }
          nodes {
            id
            name
            slug
            startAt
            endAt
            numAttendees
            url
            venueAddress
            city
            countryCode
            events {
              id
              name
              slug
              numEntrants
              videogame {
                id
                name
              }
            }
          }
        }
      }
    `;

    const data = await this.makeGraphQLRequest(query, {
      page,
      perPage,
      afterDate: now,
    });

    return {
      tournaments: data.tournaments.nodes,
      pageInfo: data.tournaments.pageInfo,
    };
  }

  async getUserTournaments(
    userSlug: string,
    page: number = 1,
    perPage: number = 20,
  ): Promise<{ tournaments: StartggTournament[]; pageInfo: any }> {
    const query = `
      query UserTournamentsQuery($slug: String!, $page: Int!, $perPage: Int!) {
        user(slug: $slug) {
          tournaments(query: {
            page: $page
            perPage: $perPage
          }) {
            pageInfo {
              page
              perPage
              totalPages
              total
            }
            nodes {
              id
              name
              slug
              startAt
              endAt
              numAttendees
              url
              venueAddress
              city
              countryCode
              events {
                id
                name
                slug
                numEntrants
                videogame {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.makeGraphQLRequest(query, {
      slug: userSlug,
      page,
      perPage,
    });

    return {
      tournaments: data.user.tournaments.nodes,
      pageInfo: data.user.tournaments.pageInfo,
    };
  }

  async getEventStandings(
    eventSlug: string,
    page: number = 1,
    perPage: number = 50,
  ): Promise<any> {
    const query = `
      query EventStandingsQuery($slug: String!, $page: Int!, $perPage: Int!) {
        event(slug: $slug) {
          standings(query: {
            page: $page
            perPage: $perPage
          }) {
            pageInfo {
              page
              perPage
              totalPages
              total
            }
            nodes {
              standing
              entrant {
                id
                name
                participants {
                  id
                  gamerTag
                  user {
                    id
                    slug
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.makeGraphQLRequest(query, {
      slug: eventSlug,
      page,
      perPage,
    });

    return {
      standings: data.event.standings.nodes,
      pageInfo: data.event.standings.pageInfo,
    };
  }

  async validateApiConnection(): Promise<boolean> {
    try {
      const query = `
        query {
          currentUser {
            id
            slug
          }
        }
      `;

      await this.makeGraphQLRequest(query);
      return true;
    } catch (error) {
      this.logger.error('Start.gg API connection validation failed:', error.message);
      return false;
    }
  }
}