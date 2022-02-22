import { createApp } from 'vue'
import App from './App.vue'
import { getConfig } from './ipc'
import { initSentry } from '@/plugins/sentry'
import ElementPlus from 'element-plus'
import 'element-plus/lib/theme-chalk/index.css'
document.title = 'Map Synchronization - Genshin Multi Tool'
async function main() {
    const config = await getConfig()
    const app = createApp(App)
    initSentry(config, app)
    app.use(ElementPlus).mount('#app')
}
main()
