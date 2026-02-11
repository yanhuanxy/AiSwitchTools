import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: Clean LLM Node Roles...');
  
  const workflows = await prisma.workflow.findMany();
  let updatedCount = 0;

  for (const wf of workflows) {
    if (!wf.graphData) continue;

    try {
      const graph = JSON.parse(wf.graphData);
      let modified = false;

      // 遍历所有节点
      if (Array.isArray(graph.nodes)) {
        graph.nodes = graph.nodes.map((node: any) => {
          if (node.type === 'llm' && node.data && node.data.roleId) {
            console.log(`Cleaning node ${node.id} in workflow ${wf.id}`);
            
            // 移除 roleId
            delete node.data.roleId;
            
            // 如果 systemPrompt 不存在，可能需要根据情况处理，这里简单处理为只移除绑定
            // 因为新的逻辑支持 Context Injection，所以不需要硬拷贝旧角色的 Prompt
            
            modified = true;
          }
          return node;
        });
      }

      if (modified) {
        await prisma.workflow.update({
          where: { id: wf.id },
          data: { graphData: JSON.stringify(graph) }
        });
        updatedCount++;
      }
    } catch (e) {
      console.error(`Failed to parse graph for workflow ${wf.id}`, e);
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} workflows.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
