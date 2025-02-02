/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { isOpenTelemetryAgentName } from '../../../common/agent_name';
import { AgentName } from '../../../typings/es_schemas/ui/fields/agent';
import { APMEventClient } from '../../lib/helpers/create_es_client/create_apm_event_client';
import { RandomSampler } from '../../lib/helpers/get_random_sampler';
import { getAgentsItems } from './get_agents_items';
import { getAgentDocsPageUrl } from './get_agent_url_repository';

const getOtelAgentVersion = (item: {
  agentTelemetryAutoVersion: string[];
  agentVersion: string[];
}) => {
  // Auto version should take precedence over sdk version
  return item.agentTelemetryAutoVersion.length > 0
    ? item.agentTelemetryAutoVersion
    : item.agentVersion;
};

export async function getAgents({
  environment,
  serviceName,
  agentLanguage,
  kuery,
  apmEventClient,
  start,
  end,
  randomSampler,
}: {
  environment: string;
  serviceName?: string;
  agentLanguage?: string;
  kuery: string;
  apmEventClient: APMEventClient;
  start: number;
  end: number;
  randomSampler: RandomSampler;
}) {
  const items = await getAgentsItems({
    environment,
    serviceName,
    agentLanguage,
    kuery,
    apmEventClient,
    start,
    end,
    randomSampler,
  });

  return {
    items: items.map((item) => {
      const agentVersion = isOpenTelemetryAgentName(item.agentName)
        ? getOtelAgentVersion(item)
        : item.agentVersion;

      const { agentTelemetryAutoVersion, ...rest } = item;

      return {
        ...rest,
        agentVersion,
        agentDocsPageUrl: getAgentDocsPageUrl(item.agentName as AgentName),
      };
    }),
  };
}
