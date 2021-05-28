import {
  graphqlWithAuth,
  GET_ISSUES,
  GET_REPOSITORY,
  MAX_LIMIT,
} from './graphql'
import {
  Backlog,
  BacklogItem,
  BacklogSettings,
  Vote,
  VoteSummary,
} from 'src/types'
import { BacklogService } from 'src/services/interfaces/backlog'
import { VotingRepository } from 'src/repository/interfaces/voting'

export class GithubService implements BacklogService {
  private type = 'github'
  private repository: VotingRepository

  constructor(repository: VotingRepository) {
    this.repository = repository
  }

  public async GetBacklog(id: string): Promise<Backlog> {
    if (!id) throw new Error('id is empty or undefined.')

    try {
      const owner = id.replace(`${this.type}:`, '').split('/')[0]
      const repo = id.replace(`${this.type}:`, '').split('/')[1]

      const response = await graphqlWithAuth(GET_REPOSITORY(), {
        owner: owner,
        repo: repo,
      })

      return this.ToBacklog(response.repository)
    } catch (e) {
      console.log(`Unable to get backlog ${id}`)
      console.error(e)
    }
  }

  public async GetBacklogItems(id: string): Promise<Array<BacklogItem>> {
    if (!id) throw new Error('id is empty or undefined.')

    try {
      const owner = id.replace(`${this.type}:`, '').split('/')[0]
      const repo = id.replace(`${this.type}:`, '').split('/')[1]

      // TODO: Pagination - and/or recursively fetch all if it's statically generated & cached
      const results = await Promise.all([
        graphqlWithAuth(GET_ISSUES('ISSUE'), {
            owner,
            repo: repo,
            state: 'OPEN',
            sort: 'UPDATED_AT',
            order: 'DESC',
            size: MAX_LIMIT,
        }),
        this.repository.GetBacklogVotesAggregated(id)
      ])

      return this.ToItems(results[0].repository, results[1])
    } catch (e) {
      console.log(`Unable to get backlog items ${id}`)
      console.error(e)
    }
  }

  public async GetBacklogVotes(
    owner: string,
    id: string,
    state?: 'ALL' | 'OPEN' | 'CLOSED',
    address?: string,
    numbers?: number[]
  ): Promise<Array<Vote>> {
    if (!owner || !id) throw new Error('Properties are empty or undefined.')

    try {
      return this.repository.GetBacklogVotes(owner, id, state, address, numbers)
    } catch (e) {
      console.log(`Unable to get backlog votes ${id}`)
      console.error(e)
    }
  }

  private ToBacklog(source: any): Backlog {
    return {
      id: `${this.type}:${source.owner.login}/${source.name}`.toLowerCase(),
      type: this.type,
      name: source.name,
      description: source.description,
      imageUrl: source.owner.avatarUrl,
      url: source.url,
      owner: source.owner.login,
      settings: source.settings?.data
        ? (JSON.parse(source.settings.data) as BacklogSettings)
        : null,
      items: this.ToItems(source, []),
    }
  }

  private ToItems(source: any, votes: Array<VoteSummary>): Array<BacklogItem> {
    if (source.issues?.nodes) {
      return source.issues.nodes.map((issue: any) =>
        this.ToItem(
          issue,
          votes.find((v) => v.number === issue.number)
        )
      )
    }
    if (source.pullRequests?.nodes) {
      return source.pullRequests.nodes.map((pr: any) =>
        this.ToItem(
          pr,
          votes.find((v) => v.number === pr.number)
        )
      )
    }

    return []
  }

  private ToItem(source: any, summary: VoteSummary | undefined): BacklogItem {
    return {
      id: source.id,
      number: source.number,
      title: source.title,
      state: source.state,
      type: source.url?.includes('issues') ? 'ISSUE' : 'PR',
      // created: new Date(source.createdAt),
      // updated: new Date(source.updatedAt),
      // closed: new Date(source.closedAt),
      url: source.url,
      commentsCount: source.comments.totalCount,
      voteSummary: summary ?? null,
      votes: [],
    }
  }
}
