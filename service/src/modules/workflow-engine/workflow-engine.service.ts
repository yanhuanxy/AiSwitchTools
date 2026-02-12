import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RagService } from '../rag/rag.service';
import { WorkflowContext, WorkflowNode } from './types';
import { ModelConfigService } from '../llm/model-config.service';

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(LlmService) private llmService: LlmService,
    @Inject(RagService) private ragService: RagService,
    @Inject(ModelConfigService) private readonly modelConfigService: ModelConfigService,
  ) {}

  async executeWorkflow(
    workflowId: string,
    initialContext: Omit<WorkflowContext, 'variables' | 'traceLog'>,
  ): Promise<string> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow || !workflow.graphData) {
      throw new Error('Workflow not found or empty');
    }

    const graph = JSON.parse(workflow.graphData);
    return this.executeGraph(graph, initialContext, workflow.name);
  }

  async executeDynamicWorkflow(
    graphData: any,
    initialContext: Omit<WorkflowContext, 'variables' | 'traceLog'>,
  ): Promise<string> {
    return this.executeGraph(graphData, initialContext, 'Dynamic Workflow');
  }

  private async executeGraph(
    graph: any,
    initialContext: Omit<WorkflowContext, 'variables' | 'traceLog'>,
    workflowName: string
  ): Promise<string> {
    const nodes: WorkflowNode[] = graph.nodes;
    const edges: any[] = graph.edges;

    // Initialize context
    const context: WorkflowContext = {
      ...initialContext,
      variables: {},
      traceLog: [],
    };

    // Find Start Node
    let currentNode = nodes.find((n) => n.type === 'start');
    if (!currentNode) {
      throw new Error('No Start node found in workflow');
    }

    context.traceLog.push(`[System] Started workflow ${workflowName}`);

    // Execution Loop (Simple linear/branching traversal)
    // Limitation: Does not support parallel branches or cycles effectively yet (MVP)
    const maxSteps = 20;
    let steps = 0;

    while (currentNode && steps < maxSteps) {
      steps++;
      context.traceLog.push(`[${currentNode.type}] Executing node ${currentNode.id}`);

      try {
        const result = await this.executeNode(currentNode, context, edges);
        
        // Check for End Node
        if (currentNode.type === 'end') {
          context.traceLog.push(`[System] Workflow finished`);
          return typeof result === 'string' ? result : JSON.stringify(result);
        }

        // Find next node
        // 1. If result specifies next node (branching), use it
        // 2. Else find edge source=currentNode.id
        let nextNodeId = result?.nextNodeId;
        
        if (!nextNodeId) {
          const edge = edges.find((e) => e.source === currentNode?.id);
          nextNodeId = edge?.target;
        }

        if (!nextNodeId) {
          context.traceLog.push(`[System] No next node found, terminating`);
          break;
        }

        currentNode = nodes.find((n) => n.id === nextNodeId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        context.traceLog.push(`[Error] Node execution failed: ${message}`);
        throw error;
      }
    }

    return context.variables['output'] || 'Workflow completed without explicit output';
  }

  private async executeNode(node: WorkflowNode, context: WorkflowContext, edges: any[]): Promise<any> {
    const execute = async () => {
      switch (node.type) {
        case 'start':
          context.variables['user_input'] = context.input;
          return null;

        case 'semantic-analysis':
          return this.executeSemanticNode(node, context);

        case 'llm':
          return this.executeLlmNode(node, context);

        case 'knowledge-base':
          return this.executeKbNode(node, context);

        case 'condition':
          return this.executeConditionNode(node, context, edges);

        case 'end':
          const outputVar = node.data?.outputVar || 'llm_result';
          return context.variables[outputVar] || context.variables['user_input'];

        default:
          this.logger.warn(`Unknown node type: ${node.type}`);
          return null;
      }
    };

    // Apply Retry Logic for external calls (LLM, KB)
    if (['llm', 'knowledge-base', 'semantic-analysis'].includes(node.type)) {
      return this.withRetry(execute, 3, 200);
    }
    return execute();
  }

  private async withRetry<T>(fn: () => Promise<T>, retries: number, delay: number): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.withRetry(fn, retries - 1, delay * 2);
    }
  }

  private async executeSemanticNode(node: WorkflowNode, context: WorkflowContext) {
    const query = context.variables['user_input'];
    const prompt = `Analyze the following query.
Query: ${query}
Return ONLY a JSON object with: { "intent": "string", "keywords": ["string"] }`;

    const response = await this.llmService.chatCompletion(
      [{ role: 'user', content: prompt }],
      { model: this.modelConfigService.semanticAnalysisModel }
    );

    let result;
    try {
        // Try to find JSON in response if it contains markdown code blocks
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : response;
        result = JSON.parse(jsonStr);
    } catch (e) {
        this.logger.warn('Failed to parse semantic analysis JSON', e);
        result = { intent: 'general', keywords: [query] };
    }
    
    context.variables['semantic_result'] = result;
    context.variables['keywords'] = Array.isArray(result.keywords) ? result.keywords.join(' ') : String(result.keywords);
    context.traceLog.push(`[Semantic] Intent: ${result.intent}`);
    return { output: result };
  }

  private async executeLlmNode(node: WorkflowNode, context: WorkflowContext) {
    const promptTemplate = node.data?.prompt || '{{user_input}}';
    const model = node.data?.model || this.modelConfigService.defaultChatModel;

    // Simple template replacement
    let prompt = promptTemplate;
    for (const [key, value] of Object.entries(context.variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // Call LLM Service
    const messages: any[] = [{ role: 'user', content: prompt }];
    
    // We can inject system prompt if configured in node or context
    let systemPrompt = node.data?.systemPrompt;
    
    // Dynamic Context Injection (fallback to agent context if not explicit in node)
    if (!systemPrompt && context.variables['agent_system_prompt']) {
        systemPrompt = context.variables['agent_system_prompt'];
    }

    if (systemPrompt) {
      messages.unshift({ role: 'system', content: systemPrompt });
    }

    try {
      const response = await this.llmService.chatCompletion(messages, { model });
      context.variables['llm_result'] = response;
      return { output: response };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`LLM Node Execution Failed: ${message}`);
      throw error;
    }
  }

  private async executeConditionNode(node: WorkflowNode, context: WorkflowContext, edges: any[]) {
    // Logic: IF {{variable}} contains/equals "value" THEN path1 ELSE path2
    // Config: { variable: "llm_result", operator: "contains", value: "error", trueLabel: "True", falseLabel: "False" }
    
    const variableName = node.data?.variable || 'llm_result';
    const operator = node.data?.operator || 'contains';
    const targetValue = node.data?.value || '';
    
    const actualValue = String(context.variables[variableName] || '');
    let result = false;

    switch (operator) {
      case 'contains':
        result = actualValue.includes(targetValue);
        break;
      case 'equals':
        result = actualValue === targetValue;
        break;
      case 'not_equals':
        result = actualValue !== targetValue;
        break;
      default:
        result = false;
    }

    context.traceLog.push(`[Condition] ${variableName} ("${actualValue}") ${operator} "${targetValue}" => ${result}`);

    // Find outgoing edge based on result
    // We assume edges from condition node have 'label' or 'handle' matching true/false
    // For simplicity in MVP: 
    // - Edge with label "True" or handle "true" -> True Path
    // - Edge with label "False" or handle "false" -> False Path
    
    const targetHandle = result ? 'true' : 'false';
    const edge = edges.find(e => e.source === node.id && (e.sourceHandle === targetHandle || e.label === (result ? 'True' : 'False')));
    
    if (!edge) {
      this.logger.warn(`[Condition] No edge found for result ${result}`);
      return { output: result };
    }

    return { output: result, nextNodeId: edge.target };
  }

  private async executeKbNode(node: WorkflowNode, context: WorkflowContext) {
    const kbId = node.data?.knowledgeBaseId;
    if (!kbId) throw new Error('Knowledge Base ID missing in node config');

    const query = context.variables['keywords'] || context.variables['user_input']; // Use keywords if available
    
    // RagService now returns RetrievalResult[]
    const results = await this.ragService.retrieve(kbId, query);
    
    // Format context for LLM
    const contextStr = results.map((r: any) => `[Source: ${r.metadata?.documentId || 'unknown'}] (Score: ${r.score.toFixed(2)})\n${r.content}`).join('\n\n');
    
    context.variables['context'] = contextStr;
    context.variables['retrieved_docs'] = results;
    context.traceLog.push(`[RAG] Retrieved ${results.length} chunks`);
    return { output: results };
  }
}
