export interface WorkflowContext {
  userId: string;
  conversationId: string;
  input: string; // User query
  history: any[]; // Chat history
  variables: Record<string, any>; // Runtime variables
  traceLog: string[]; // Execution log
}

export interface WorkflowNode {
  id: string;
  type: string;
  data: any; // Configuration
  next?: string[]; // Outgoing edge target IDs
}

export interface NodeExecutionResult {
  output: any;
  nextNodeId?: string; // For branching
}
