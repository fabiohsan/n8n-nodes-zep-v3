import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ZepApiV3 implements ICredentialType {
  name = 'zepApiV3';
  displayName = 'Zep API (v3)';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Zep API key. Header format: <code>Authorization: Api-Key &lt;token&gt;</code>',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.getzep.com',
      placeholder: 'https://api.getzep.com',
    },
  ];

  // Attach default headers for all HTTP requests using these credentials
  authenticate = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: 'Api-Key {{$credentials.apiKey}}',
        'Content-Type': 'application/json',
      },
    },
  } as const;

  // Simple connectivity test: list threads (works with Zep Cloud & self-hosted)
  test = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/api/v2/threads',
      method: 'GET',
    },
  } as const;
}
