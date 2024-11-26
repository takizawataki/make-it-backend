import { ChatBedrockConverse } from '@langchain/aws';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import {
  AIMessage,
  HumanMessage,
  MessageContent,
} from '@langchain/core/messages';
import { MessagesAnnotation, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { BufferMemory } from 'langchain/memory';
import { GenerateAiReplyRequestUserAgent } from '@/lambda-ts/types/generated/models/GenerateAiReplyRequestUserAgent';
import { getSecretValue } from '@/lambda-ts/utils/secretsManager';

export const graph = async (
  input: string,
  memory: BufferMemory,
  message: string,
  userAgent: GenerateAiReplyRequestUserAgent | undefined,
) => {
  await setUpLangChain();

  const tools = [new TavilySearchResults({ maxResults: 1 })];
  const toolNode = new ToolNode(tools);

  // https://js.langchain.com/docs/integrations/chat/bedrock_converse
  const model = new ChatBedrockConverse({
    model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    temperature: 0,
    maxTokens: 4096,
    region: 'ap-northeast-1',
    streaming: true,
    // callbacks: [new CustomHandler()],
  }).bindTools(tools);

  // We add a tag that we'll be using later to filter outputs
  const finalModel = new ChatBedrockConverse({
    model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    temperature: 0,
    maxTokens: 4096,
    region: 'ap-northeast-1',
    streaming: true,
    // callbacks: [new CustomHandler()],
  }).withConfig({
    tags: ['final_node'],
  });

  const shouldContinue = async (state: typeof MessagesAnnotation.State) => {
    const messages = state.messages;
    const lastMessage: AIMessage = messages[messages.length - 1];
    // If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.tool_calls?.length) {
      return 'tools';
    }
    // Otherwise, we stop (reply to the user)
    return 'final';
  };
  const callModel = async (state: typeof MessagesAnnotation.State) => {
    const messages = state.messages;
    const response = await model.invoke(messages);
    // We return a list, because this will get added to the existing list
    return { messages: [response] };
  };

  const callFinalModel = async (state: typeof MessagesAnnotation.State) => {
    const messages = state.messages;
    const lastAIMessage = messages[messages.length - 1];
    const response = await finalModel.invoke([
      // new SystemMessage('Rewrite this in the voice of Al Roker'),
      new HumanMessage({ content: buildPrompt(lastAIMessage.content) }),
    ]);
    await memory.saveContext(
      { input: (userAgent ? userAgentPrompt(userAgent) : '') + message },
      { output: lastAIMessage.content },
    );
    // MessagesAnnotation allows you to overwrite messages from the agent
    // by returning a message with the same id
    response.id = lastAIMessage.id;
    return { messages: [response] };
  };

  const buildPrompt = (aiMessage: MessageContent) => {
    const stringAiMessage =
      typeof aiMessage === 'string' ? aiMessage : JSON.stringify(aiMessage);
    const content = `
# 指示
以下の文字列だけを出力してください。
${stringAiMessage}
`;
    return content;
  };

  const userAgentPrompt = (agent: GenerateAiReplyRequestUserAgent) => {
    return `# 質問者の情報
- OS: ${agent.osName}
- ブラウザ: ${agent.browserName}
- デバイス: ${agent.deviceName}\n`;
  };

  // Define a new graph
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', callModel)
    .addNode('tools', toolNode)
    // add a separate final node
    .addNode('final', callFinalModel)
    .addEdge('__start__', 'agent')
    // Third parameter is optional and only here to draw a diagram of the graph
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      final: 'final',
    })
    .addEdge('tools', 'agent')
    .addEdge('final', '__end__')
    .compile();

  const inputs = {
    messages: [new HumanMessage(input)],
  };

  return await workflow.streamEvents(inputs, { version: 'v2' });
};

/**
 * LangChain の SetUp
 * @see https://js.langchain.com/docs/integrations/chat/bedrock#credentials
 */
const setUpLangChain = async () => {
  const [secret, tavilySecret] = await Promise.all([
    getSecretValue<{ LANGCHAIN_API_KEY: string }>('LANGCHAIN_API_KEY'),
    getSecretValue<{ TAVILY_API_KEY: string }>('TAVILY_API_KEY'),
  ]);
  process.env.LANGCHAIN_TRACING_V2 = 'true';
  process.env.LANGCHAIN_API_KEY = secret.LANGCHAIN_API_KEY;
  process.env.TAVILY_API_KEY = tavilySecret.TAVILY_API_KEY;
};
