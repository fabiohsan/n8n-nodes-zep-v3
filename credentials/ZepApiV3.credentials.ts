import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class ZepApiV3 implements ICredentialType {
  name = 'zepApiV3';
  displayName = 'Zep API (v3)';
  documentationUrl = 'https://docs.getzep.com';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Zep API key. Header format: Authorization: Api-Key <token>',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.getzep.com',
      placeholder: 'https://api.getzep.com',
      description: 'Base URL for Zep API. Default is https://api.getzep.com for Zep Cloud.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Api-Key {{$credentials.apiKey}}',
        'Content-Type': 'application/json',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/api/v2/threads',
      method: 'GET',
    },
  };
}

