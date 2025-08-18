import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

// Minimal in-process memory adapter that n8n AI nodes can consume via the `ai_memory` port.
// It exposes methods n8n expects: getMessages, addMessages, clear.
class ZepV3MemoryAdapter {
  constructor(
    private http: IExecuteFunctions,
    private baseUrl: string,
    private threadId: string,
    private mode: 'basic' | 'summary',
    private returnContext: boolean,
  ) {}

  async getMessages() {
    // v3: GET /api/v2/threads/:threadId/messages
    const res = await this.http.helpers.httpRequest({
      baseURL: this.baseUrl,
      url: `/api/v2/threads/${this.threadId}/messages`,
      method: 'GET',
    });
    // Return as array of { role, content, name? }
    return (res?.messages ?? []).map((m: any) => ({ role: m.role, content: m.content, name: m.name }));
  }

  async addMessages(messages: Array<{ role: string; content: string; name?: string }>) {
    // v3: POST /api/v2/threads/:threadId/messages
    const body = { messages, return_context: this.returnContext };
    return this.http.helpers.httpRequest({
      baseURL: this.baseUrl,
      url: `/api/v2/threads/${this.threadId}/messages`,
      method: 'POST',
      body,
    });
  }

  async getUserContext() {
    // v3: GET /api/v2/threads/:threadId/context?mode=basic|summary
    const res = await this.http.helpers.httpRequest({
      baseURL: this.baseUrl,
      url: `/api/v2/threads/${this.threadId}/context`,
      method: 'GET',
      qs: { mode: this.mode },
    });
    return res?.context ?? '';
  }

  async clear() {
    // v3: DELETE /api/v2/threads/:threadId
    await this.http.helpers.httpRequest({
      baseURL: this.baseUrl,
      url: `/api/v2/threads/${this.threadId}`,
      method: 'DELETE',
    });
    return true;
  }
}

export class ZepMemoryV3 implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Zep Memory (v3)',
    name: 'zepMemoryV3',
    icon: 'file:zep-logo.png',
    group: ['transform'],
    version: 1,
    subtitle: 'Threads & User Context',
    description: 'Use Zep v3 Threads as chat memory',
    defaults: { name: 'Zep Memory (v3)' },
    // Sub-node: no data inputs, special AI output
    inputs: [],
    outputs: ['ai_memory'],
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
          { name: 'Basic (matches v2 memory.get)', value: 'basic' },
          { name: 'Summary (default in v3)', value: 'summary' },
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
          'If enabled, thread.add_messages will return the (basic) context block alongside message UUIDs',
      },
      {
        displayName: 'Auto-create Thread',
        name: 'autoCreate',
        type: 'boolean',
        default: true,
        description:
          'If enabled, create the thread in Zep on first use if it doesn\'t exist',
      },
      {
        displayName: 'User ID',
        name: 'userId',
        type: 'string',
        default: '',
        description:
          'Optional user_id to associate with the thread (helps cross-thread graph building)',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('zepApiV3');
    const baseUrl = credentials.baseUrl as string;

    const threadId = this.getNodeParameter('sessionId', 0) as string;
    const autoCreate = this.getNodeParameter('autoCreate', 0) as boolean;
    const userId = (this.getNodeParameter('userId', 0) as string) || undefined;
    const mode = (this.getNodeParameter('mode', 0) as 'basic' | 'summary') ?? 'basic';
    const returnContext = (this.getNodeParameter('returnContext', 0) as boolean) ?? false;

    // Optionally create the thread if it does not exist
    if (autoCreate) {
      try {
        await this.helpers.httpRequest({
          baseURL: baseUrl,
          url: `/api/v2/threads/${threadId}`,
          method: 'GET',
        });
      } catch {
        await this.helpers.httpRequest({
          baseURL: baseUrl,
          url: `/api/v2/threads`,
          method: 'POST',
          body: { thread_id: threadId, user_id: userId },
        });
      }
    }

    // Expose an adapter instance on the special AI memory port
    const adapter = new ZepV3MemoryAdapter(this, baseUrl, threadId, mode, returnContext);

    const item: INodeExecutionData = {
      json: {},
      // n8n will pick this up when wired to the AI node via ai_memory port
      context: {
        ai: {
          memory: adapter,
        },
      } as any,
    };

    return [[item]];
  }
}