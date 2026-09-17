import { MatchGroupStatus } from '@logix/shared';

export interface ProposeMatchingDto {
  laneId?: string;
}

export interface CreateMatchGroupDto {
  laneId: string;
  targetContainerTypeId: string;
  shipmentIds: string[];
  cutoffTime?: string;
}

export interface MatchGroupQueryDto {
  laneId?: string;
  status?: MatchGroupStatus;
  limit?: number;
  cursor?: string;
}
