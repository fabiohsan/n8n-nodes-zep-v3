import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class ZepVectorStoreV3 implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Zep Vector Store (v3)',
    name: 'zepVectorStoreV3',
    icon: 'file:zep-logo.png',
    group: ['transform'],
    version: 1,
    description: 'Insert, search, and retrieve documents from Zep Collections (v2 endpoints)',
    defaults: { name: 'Zep Vector Store (v3)' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'zepApiV3', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        options: [
          { name: 'Insert', value: 'insert' },
          { name: 'Search', value: 'search' },
          { name: 'Get Many', value: 'getMany' },
        ],
        default: 'search',
      },
      {
        displayName: 'Collection Name',
        name: 'collectionName',
        type: 'string',
        default: '',
        required: true,
      },
      // INSERT
      {
        displayName: 'Document Content',
        name: 'content',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '={{$json.content}}',
        displayOptions: { show: { operation: ['insert'] } },
      },
      {
        displayName: 'Metadata',
        name: 'metadata',
        type: 'json',
        default: '={{$json.metadata}}',
        displayOptions: { show: { operation: ['insert'] } },
      },
      {
        displayName: 'Document ID',
        name: 'documentId',
        type: 'string',
        default: '',
        description: 'Optional external ID (<= 100 chars)',
        displayOptions: { show: { operation: ['insert'] } },
      },
      // SEARCH
      {
        displayName: 'Query Text',
        name: 'query',
        type: 'string',
        default: '={{$json.query}}',
        required: true,
        displayOptions: { show: { operation: ['search'] } },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 200 },
        default: 10,
        displayOptions: { show: { operation: ['search'] } },
      },
      {
        displayName: 'Search Type',
        name: 'searchType',
        type: 'options',
        options: [
          { name: 'Similarity', value: 'similarity' },
          { name: 'MMR', value: 'mmr' },
        ],
        default: 'similarity',
        displayOptions: { show: { operation: ['search'] } },
      },
      {
        displayName: 'MMR Lambda',
        name: 'mmrLambda',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 1 },
        default: 0.5,
        displayOptions: { show: { operation: ['search'], searchType: ['mmr'] } },
      },
      // GET MANY
      {
        displayName: 'Document UUIDs',
        name: 'uuids',
        type: 'string',
        default: '',
        description: 'Comma-separated UUIDs',
        displayOptions: { show: { operation: ['getMany'] } },
      },
      {
        displayName: 'Document IDs',
        name: 'documentIds',
        type: 'string',
        default: '',
        description: 'Comma-separated document_ids (external IDs)',
        displayOptions: { show: { operation: ['getMany'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions) {
    const items = this.getInputData();
    const credentials = await this.getCredentials('zepApiV3');
    const baseURL = credentials.baseUrl as string;

    const operation = this.getNodeParameter('operation', 0) as string;
    const collection = this.getNodeParameter('collectionName', 0) as string;

    const out: INodeExecutionData[] = [];

    if (operation === 'insert') {
      // v2: POST /api/v2/collections/:collection/documents
      for (let i = 0; i < items.length; i++) {
        const content = this.getNodeParameter('content', i) as string;
        const metadata = this.getNodeParameter('metadata', i) as any;
        const document_id = (this.getNodeParameter('documentId', i) as string) || undefined;
        const body = [{ content, metadata, document_id }];
        const res = await this.helpers.httpRequest({
          baseURL,
          url: `/api/v2/collections/${encodeURIComponent(collection)}/documents`,
          method: 'POST',
          body,
        });
        out.push({ json: { uuids: res?.[0] ?? [] } });
      }
    }

    if (operation === 'search') {
      // v2: POST /api/v2/collections/:collection/search
      for (let i = 0; i < items.length; i++) {
        const text = this.getNodeParameter('query', i) as string;
        const limit = this.getNodeParameter('limit', i) as number;
        const search_type = this.getNodeParameter('searchType', i) as 'similarity' | 'mmr';
        const mmr_lambda = (this.getNodeParameter('mmrLambda', i) as number) ?? undefined;
        const body: any = { text, search_type };
        if (limit) body.limit = limit;
        if (search_type === 'mmr' && typeof mmr_lambda === 'number') body.mmr_lambda = mmr_lambda;
        const res = await this.helpers.httpRequest({
          baseURL,
          url: `/api/v2/collections/${encodeURIComponent(collection)}/search`,
          method: 'POST',
          body,
        });
        const results = res?.results ?? [];
        out.push(...results.map((r: any) => ({ json: r })));
      }
    }

    if (operation === 'getMany') {
      // v2: POST /api/v2/collections/:collection/documents/batchGet
      const uuidsCsv = (this.getNodeParameter('uuids', 0) as string) || '';
      const idsCsv = (this.getNodeParameter('documentIds', 0) as string) || '';
      const uuids = uuidsCsv.split(',').map((s) => s.trim()).filter(Boolean);
      const document_ids = idsCsv.split(',').map((s) => s.trim()).filter(Boolean);
      const body: any = {};
      if (uuids.length) body.uuids = uuids;
      if (document_ids.length) body.document_ids = document_ids;

      const res = await this.helpers.httpRequest({
        baseURL,
        url: `/api/v2/collections/${encodeURIComponent(collection)}/documents/batchGet`,
        method: 'POST',
        body,
      });
      // API returns an array of arrays (per request doc); flatten
      const docs = Array.isArray(res) ? res.flat() : [];
      return [docs.map((d: any) => ({ json: d }))];
    }

    return [out];
  }
}