import { Vote } from 'src/types'
import useSWR from 'swr'
import { fetcher } from './fetcher'

export function useBacklogVotes(id: string): Array<Vote> {
  const { data, error } = useSWR(`/api/votes?backlog=${id}`, fetcher)

  if (error) {
    console.log('Failed to load backlog votes', id)
    return []
  }
  if (!data) return []

  return data
}