import { createRouter, createWebHistory } from "vue-router"

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/roles" },
    { path: "/roles", component: () => import("../pages/RolesPage.vue") },
    { path: "/roles/create", component: () => import("../pages/role/RoleCreatePage.vue") },
    { path: "/roles/:id", component: () => import("../pages/role/RoleDetailPage.vue") },
    { path: "/roles/:id/edit", component: () => import("../pages/role/RoleEditPage.vue") },
    { path: "/chat/:conversationId", component: () => import("../pages/ChatPage.vue") },
    { path: "/history", component: () => import("../pages/HistoryPage.vue") },
    { path: "/auth/bind", component: () => import("../pages/AuthBindPage.vue") },
    { path: "/auth/magic-link", component: () => import("../pages/MagicLinkCallbackPage.vue") },
    { path: "/workflows", component: () => import("../pages/WorkflowPage.vue") },
    { path: "/workflows/:id/editor", component: () => import("../pages/WorkflowEditorPage.vue") },
    { path: "/knowledge-bases", component: () => import("../pages/KnowledgeBasePage.vue") },
    { path: "/knowledge-bases/:id", component: () => import("../pages/KnowledgeBaseDetailPage.vue") }
  ]
})

export default router
