import {
  NodeApiError,
  NodeOperationError,
  type IExecuteFunctions,
  type IDataObject,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
} from 'n8n-workflow';

export class ZepVectorStoreV3 implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Zep Vector Store (v3)',
    name: 'zepVectorStoreV3',
    icon: 'file:zep-logo.png',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["collectionName"]}}',
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
        noDataExpression: true,
        options: [
          { name: 'Insert', value: 'insert', description: 'Insert documents into collection' },
          { name: 'Search', value: 'search', description: 'Search collection using semantic similarity or MMR' },
          { name: 'Get Many', value: 'getMany', description: 'Retrieve documents by UUIDs or Document IDs' },
        ],
        default: 'search',
      },
      {
        displayName: 'Collection Name',
        name: 'collectionName',
        type: 'string',
        default: '',
        required: true,
        description: 'Name of the Zep collection',
      },
      // INSERT
      {
        displayName: 'Document Content',
        name: 'content',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '={{$json.content}}',
        required: true,
        displayOptions: { show: { operation: ['insert'] } },
        description: 'Text content of the document to insert',
      },
      {
        displayName: 'Metadata',
        name: 'metadata',
        type: 'json',
        default: '={{$json.metadata}}',
        displayOptions: { show: { operation: ['insert'] } },
        description: 'Optional metadata dictionary to attach to the document',
      },
      {
        displayName: 'Document ID',
        name: 'documentId',
        type: 'string',
        default: '',
        description: 'Optional external ID (<= 100 characters)',
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
        description: 'Query text to search for',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 200 },
        default: 10,
        displayOptions: { show: { operation: ['search'] } },
        description: 'Maximum number of results to return',
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
        description: 'Search algorithm to use (Similarity or Maximal Marginal Relevance)',
      },
      {
        displayName: 'MMR Lambda',
        name: 'mmrLambda',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 1 },
        default: 0.5,
        displayOptions: { show: { operation: ['search'], searchType: ['mmr'] } },
        description: 'Diversity factor for MMR search (0.0 = maximal diversity, 1.0 = standard similarity)',
      },
      // GET MANY
      {
        displayName: 'Document UUIDs',
        name: 'uuids',
        type: 'string',
        default: '',
        description: 'Comma-separated document UUIDs',
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

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = await this.getCredentials('zepApiV3');
    const baseURL = (credentials.baseUrl as string) || 'https://api.getzep.com';

    const operation = this.getNodeParameter('operation', 0) as string;
    const collection = this.getNodeParameter('collectionName', 0) as string;

    if (!collection) {
      throw new NodeOperationError(this.getNode(), 'Collection Name is required');
    }

    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        if (operation === 'insert') {
          const content = this.getNodeParameter('content', i) as string;
          let metadata = this.getNodeParameter('metadata', i, {}) as any;

          if (typeof metadata === 'string') {
            try {
              metadata = JSON.parse(metadata);
            } catch {
              metadata = { raw: metadata };
            }
          }

          const documentId = (this.getNodeParameter('documentId', i, '') as string) || undefined;
          const body = [{ content, metadata, ...(documentId ? { document_id: documentId } : {}) }];

          const res = await this.helpers.httpRequestWithAuthentication.call(this, 'zepApiV3', {
            baseURL,
            url: `/api/v2/collections/${encodeURIComponent(collection)}/documents`,
            method: 'POST',
            body,
          });

          const uuids = Array.isArray(res) ? res : [res];
          returnData.push({
            json: {
              success: true,
              uuids,
            },
            pairedItem: { item: i },
          });
        } else if (operation === 'search') {
          const text = this.getNodeParameter('query', i) as string;
          const limit = this.getNodeParameter('limit', i, 10) as number;
          const search_type = this.getNodeParameter('searchType', i, 'similarity') as 'similarity' | 'mmr';
          const mmr_lambda = this.getNodeParameter('mmrLambda', i, 0.5) as number;

          const body: IDataObject = { text, search_type };
          if (limit) body.limit = limit;
          if (search_type === 'mmr' && typeof mmr_lambda === 'number') {
            body.mmr_lambda = mmr_lambda;
          }

          const res = await this.helpers.httpRequestWithAuthentication.call(this, 'zepApiV3', {
            baseURL,
            url: `/api/v2/collections/${encodeURIComponent(collection)}/search`,
            method: 'POST',
            body,
          });

          const results = res?.results ?? (Array.isArray(res) ? res : []);
          for (const result of results) {
            returnData.push({
              json: result as IDataObject,
              pairedItem: { item: i },
            });
          }
        } else if (operation === 'getMany') {
          const uuidsCsv = (this.getNodeParameter('uuids', i, '') as string) || '';
          const idsCsv = (this.getNodeParameter('documentIds', i, '') as string) || '';

          const uuids = uuidsCsv.split(',').map((s) => s.trim()).filter(Boolean);
          const document_ids = idsCsv.split(',').map((s) => s.trim()).filter(Boolean);

          const body: IDataObject = {};
          if (uuids.length) body.uuids = uuids;
          if (document_ids.length) body.document_ids = document_ids;

          const res = await this.helpers.httpRequestWithAuthentication.call(this, 'zepApiV3', {
            baseURL,
            url: `/api/v2/collections/${encodeURIComponent(collection)}/documents/batchGet`,
            method: 'POST',
            body,
          });

          const docs = Array.isArray(res) ? res.flat() : [res];
          for (const doc of docs) {
            if (doc) {
              returnData.push({
                json: doc as IDataObject,
                pairedItem: { item: i },
              });
            }
          }
        }
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error.message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw new NodeApiError(this.getNode(), error, { itemIndex: i });
      }
    }

    return [returnData];
  }
}