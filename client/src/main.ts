import { createApp } from "vue"
import { createPinia, setActivePinia } from "pinia"
import ElementPlus from "element-plus"
import App from "./App.vue"
import router from "./router"
import { setupApiInterceptors } from "./services/api"
import { useAuthStore } from "./stores/auth"
import "element-plus/dist/index.css"
import "./styles/base.css"

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(ElementPlus)
setActivePinia(pinia)
setupApiInterceptors(() => useAuthStore())

app.config.errorHandler = (err, instance, info) => {
  console.error("Vue Runtime Error:", err)
  console.error("Component Instance:", instance)
  console.error("Error Info:", info)
  // Optional: Report to Sentry or other monitoring service
}

useAuthStore().ensureAuthReady().finally(() => {
  app.mount("#app")
})
