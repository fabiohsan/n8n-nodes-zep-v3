import {
  NodeApiError,
  NodeOperationError,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
  type ISupplyDataFunctions,
  type SupplyData,
  type NodeConnectionType,
} from 'n8n-workflow';

// Minimal in-process memory adapter that n8n AI nodes can consume via the `ai_memory` port.
// It exposes methods expected by LangChain chat memory integrations and n8n AI Agent.
class ZepV3MemoryAdapter {
  constructor(
    private context: IExecuteFunctions | ISupplyDataFunctions,
    private baseUrl: string,
    private threadId: string,
    private mode: 'basic' | 'summary',
    private returnContext: boolean,
  ) {}

  async getMessages() {
    try {
      const res = await this.context.helpers.httpRequestWithAuthentication.call(
        this.context,
        'zepApiV3',
        {
          baseURL: this.baseUrl,
          url: `/api/v2/threads/${encodeURIComponent(this.threadId)}/messages`,
          method: 'GET',
        },
      );
      // Return as array of { role, content, name? }
      return (res?.messages ?? []).map((m: any) => ({
        role: m.role,
        content: m.content,
        name: m.name,
      }));
    } catch {
      return [];
    }
  }

  async addMessages(messages: Array<{ role: string; content: string; name?: string }>) {
    const body = { messages, return_context: this.returnContext };
    return this.context.helpers.httpRequestWithAuthentication.call(
      this.context,
      'zepApiV3',
      {
        baseURL: this.baseUrl,
        url: `/api/v2/threads/${encodeURIComponent(this.threadId)}/messages`,
        method: 'POST',
        body,
      },
    );
  }

  async addUserMessage(message: string) {
    return this.addMessages([{ role: 'user', content: message }]);
  }

  async addAIChatMessage(message: string) {
    return this.addMessages([{ role: 'assistant', content: message }]);
  }

  async getUserContext() {
    try {
      const res = await this.context.helpers.httpRequestWithAuthentication.call(
        this.context,
        'zepApiV3',
        {
          baseURL: this.baseUrl,
          url: `/api/v2/threads/${encodeURIComponent(this.threadId)}/context`,
          method: 'GET',
          qs: { mode: this.mode },
        },
      );
      return res?.context ?? '';
    } catch {
      return '';
    }
  }

  async clear() {
    try {
      await this.context.helpers.httpRequestWithAuthentication.call(
        this.context,
        'zepApiV3',
        {
          baseURL: this.baseUrl,
          url: `/api/v2/threads/${encodeURIComponent(this.threadId)}`,
          method: 'DELETE',
        },
      );
      return true;
    } catch {
      return false;
    }
  }
}

async function ensureThread(
  context: IExecuteFunctions | ISupplyDataFunctions,
  baseUrl: string,
  threadId: string,
  userId?: string,
) {
  try {
    await context.helpers.httpRequestWithAuthentication.call(context, 'zepApiV3', {
      baseURL: baseUrl,
      url: `/api/v2/threads/${encodeURIComponent(threadId)}`,
      method: 'GET',
    });
  } catch (error: any) {
    const statusCode = error?.statusCode || error?.response?.status || error?.httpCode;
    if (statusCode === 404 || statusCode === '404' || String(error?.message).includes('404')) {
      try {
        await context.helpers.httpRequestWithAuthentication.call(context, 'zepApiV3', {
          baseURL: baseUrl,
          url: '/api/v2/threads',
          method: 'POST',
          body: { thread_id: threadId, ...(userId ? { user_id: userId } : {}) },
        });
      } catch (createError: any) {
        throw new NodeApiError(context.getNode(), createError);
      }
    } else {
      throw new NodeApiError(context.getNode(), error);
    }
  }
}

export class ZepMemoryV3 implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Zep Memory (v3)',
    name: 'zepMemoryV3',
    icon: 'file:zep-logo.png',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["sessionId"]}}',
    description: 'Use Zep v3 Threads as chat memory',
    defaults: { name: 'Zep Memory (v3)' },
    inputs: [],
    outputs: ['ai_memory' as NodeConnectionType],
    credentials: [{ name: 'zepApiV3', required: true }],
    properties: [
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: '',
        placeholder: 'thread-123',
        description: 'Mapped to Zep v3 thread_id',
        required: true,
      },
      {
        displayName: 'Mode',
        name: 'mode',
        type: 'options',
        options: [
          { name: 'Basic (Matches v2 Memory.get)', value: 'basic' },
          { name: 'Summary (Default in v3)', value: 'summary' },
        ],
        default: 'basic',
        description: 'Context flavor for retrieval from Zep',
      },
      {
        displayName: 'Return Context on Add',
        name: 'returnContext',
        type: 'boolean',
        default: false,
        description:
          'Whether thread.add_messages will return the context block alongside message UUIDs',
      },
      {
        displayName: 'Auto-Create Thread',
        name: 'autoCreate',
        type: 'boolean',
        default: true,
        description: 'Whether to create the thread in Zep on first use if it does not exist',
      },
      {
        displayName: 'User ID',
        name: 'userId',
        type: 'string',
        default: '',
        description:
          'Optional user_id to associate with the thread (helps cross-thread knowledge graph building)',
      },
    ],
  };

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    const credentials = await this.getCredentials('zepApiV3');
    const baseUrl = (credentials.baseUrl as string) || 'https://api.getzep.com';

    const threadId = this.getNodeParameter('sessionId', itemIndex) as string;
    const autoCreate = this.getNodeParameter('autoCreate', itemIndex, true) as boolean;
    const userId = (this.getNodeParameter('userId', itemIndex, '') as string) || undefined;
    const mode = (this.getNodeParameter('mode', itemIndex, 'basic') as 'basic' | 'summary');
    const returnContext = this.getNodeParameter('returnContext', itemIndex, false) as boolean;

    if (!threadId) {
      throw new NodeOperationError(this.getNode(), 'Session ID is required for Zep Memory');
    }

    if (autoCreate) {
      await ensureThread(this, baseUrl, threadId, userId);
    }

    const adapter = new ZepV3MemoryAdapter(this, baseUrl, threadId, mode, returnContext);

    return {
      response: adapter,
    };
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('zepApiV3');
    const baseUrl = (credentials.baseUrl as string) || 'https://api.getzep.com';

    const threadId = this.getNodeParameter('sessionId', 0) as string;
    const autoCreate = this.getNodeParameter('autoCreate', 0, true) as boolean;
    const userId = (this.getNodeParameter('userId', 0, '') as string) || undefined;
    const mode = (this.getNodeParameter('mode', 0, 'basic') as 'basic' | 'summary');
    const returnContext = this.getNodeParameter('returnContext', 0, false) as boolean;

    if (!threadId) {
      throw new NodeOperationError(this.getNode(), 'Session ID is required for Zep Memory');
    }

    if (autoCreate) {
      await ensureThread(this, baseUrl, threadId, userId);
    }

    const adapter = new ZepV3MemoryAdapter(this, baseUrl, threadId, mode, returnContext);

    const item: INodeExecutionData = {
      json: {},
      context: {
        ai: {
          memory: adapter,
        },
      } as any,
    };

    return [[item]];
  }
}