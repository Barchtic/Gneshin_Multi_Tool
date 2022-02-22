<script>
import { watch } from 'vue'
import { __ } from '@/i18n'
import { sleep } from './utils'
import { ipcRenderer } from 'electron'
import { status, STATUS } from './status'
import { ElMessageBox } from 'element-plus'
import { recognizeArtifact } from './recognizeArtifact'
import { ocr, split, imageDump, textDump } from './imageProcess'
import { getposition, capture, getActiveWindow, sendToAppWindow } from './ipc'

import { sendWrongOCRFeedback } from '@/api/feedback'

import AppHeader from './Components/AppHeader'
import Capture from './Components/Capture/Index'

export default {
    components: {
        AppHeader,
        Capture,
    },
    data() {
        return {
            activeWindow: '',
            intro: true,
            feedbackVisible: false,
            feedbackContent: '',
            feedbackLoading: false,
        }
    },
    computed: {
        status() {
            return status
        },
    },
    async created() {
        window.$vm = this
        ipcRenderer.on('keydown', this.onKeydown)
        ipcRenderer.on('mouseup', this.onMouseup)
        this._watchauto = watch(
            () => status.auto,
            () => {
                this.activeWindow = ''
            },
        )
        ipcRenderer.send('readyArtifactView')
        ipcRenderer.on('tryocr', async (event, { id }) => {
            const result = await this.processWithTimeout(() => {
                ipcRenderer.sendTo(event.senderId, `tryocr-${id}-capture`)
            })
            ipcRenderer.sendTo(event.senderId, `tryocr-${id}`, result)
        })
    },
    beforeUnmount() {
        this._watchauto()
        ipcRenderer.off('keydown', this.onKeydown)
        ipcRenderer.off('mouseup', this.onMouseup)
    },
    methods: {
        onKeydown(src, event) {
            if (event.keycode === status.hotkey) {
                switch (status.status) {
                    case STATUS.INTRO:
                        this.processWithTimeout()
                        break
                    default:
                        if (event.altKey) {
                            status.auto = !status.auto
                        } else if (event.metaKey) {
                            this.processWithTimeout()
                        }
                }
            }
        },
        async onMouseup(src, event) {
            await sleep(50)
            if (status.status > STATUS.INTRO && event.button === 1 && status.auto) {
                const { windowPid, windowName } = await getActiveWindow()
                const currentWin = windowPid + windowName
                if (this.activeWindow !== '' && currentWin !== this.activeWindow) {
                    status.auto = false
                } else {
                    this.processWithTimeout()
                }
                this.activeWindow = currentWin
            }
        },
        async processWithTimeout(captureCB) {
            if (status.status === STATUS.LOADING) return
            status.status = STATUS.LOADING
            try {
                const result = await this.processOnce(captureCB)
                status.status = STATUS.SUCCESS
                return result
            } catch (e) {
                console.log(e)
                status.status = STATUS.ERROR
            }
        },
        async splitImages(canvas, scale) {
            const posObj = this.$refs.captureDom.getPosition()
            return await split(canvas, posObj, scale)
        },
        async processOnce(captureCB) {
            /* 计算窗口位置 */
            const p = window.devicePixelRatio
            let [x, y] = await getposition()
            x = x * p
            y = y * p
            const w = window.innerWidth
            const h = window.innerHeight

            /* 抓屏 */
            let canvas = await capture(x, y, w * p, h * p)

            /* 拆分、预处理 */
            let ret = await this.splitImages(canvas, p)

            /* 调试写入图片文件 */
            const pid = Date.now().toString()
            if (status.runtimeDebug) {
                imageDump(canvas, ret, pid)
            }

            if (captureCB) {
                captureCB()
            }

            /* OCR、识别 */
            const ocrres = await ocr(ret)
            /* 调试写入OCR文本2 */
            if (status.runtimeDebug) {
                textDump(JSON.stringify(ocrres), pid, 'ocr.json')
            }

            /* 后处理 */
            let ares
            try {
                ares = await recognizeArtifact(ocrres, ret)
            } catch (e) {
                console.warn(ocrres)
                throw e
            }
            const [artifact, potentialErrors, ocrResult] = ares
            status.artifact = artifact
            status.potentialErrors = potentialErrors
            this.saveToMain()
            ;(async () => {
                console.log(artifact, ocrResult)
                const wrongReportData = JSON.parse(
                    JSON.stringify({
                        artifact,
                        screenshot: '',
                        message: '',
                        ocrResult: {},
                        splitImages: {},
                        version: status.version,
                        build: status.build,
                    }),
                )
                for (let i in ocrResult) {
                    if ({}.hasOwnProperty.call(ocrResult, i)) {
                        for (let j of ocrResult[i].words) {
                            delete j.line
                            delete j.page
                            delete j.block
                            delete j.paragraph
                        }
                        wrongReportData.ocrResult[i] = ocrResult[i].words
                    }
                }
                const alt = {}
                for (let i of [
                    'availHeight',
                    'availLeft',
                    'availTop',
                    'availWidth',
                    'width',
                    'height',
                    'pixelDepth',
                    'colorDepth',
                ]) {
                    alt[i] = window.screen[i]
                }
                alt.angle = window.screen.orientation.angle
                wrongReportData.screen = alt
                wrongReportData.devicePixelRatio = window.devicePixelRatio
                wrongReportData.windowWidth = window.innerWidth
                wrongReportData.windowHeight = window.innerHeight
                status.wrongReportData = wrongReportData
                status.wrongReportData.screenshot = canvas.toDataURL('image/webp')
                for (const i in ret) {
                    if ({}.hasOwnProperty.call(ret, i)) {
                        if (i === 'color') continue
                        status.wrongReportData.splitImages[i] = ret[i].canvas.toDataURL('image/webp')
                    }
                }
            })()
            return artifact
        },
        async saveToMain() {
            status.artifactBackup = JSON.parse(JSON.stringify(status.artifact))
            sendToAppWindow('artifactPush', JSON.parse(JSON.stringify(status.artifact)))
        },
        async onModify() {
            this.saveToMain()
            status.status = STATUS.MODIFIED
            status.potentialErrors = []
        },
        async onDelete() {
            sendToAppWindow('artifactDelete', { id: status.artifact.id })
            status.status = STATUS.DELETED
            status.potentialErrors = []
        },
        async onReset() {
            if (status.artifactBackup) {
                status.artifact = JSON.parse(JSON.stringify(status.artifactBackup))
            }
        },
        async onFeedback() {
            this.feedbackContent = ''
            this.feedbackLoading = false
            this.feedbackVisible = true
        },
        async doFeedback() {
            this.feedbackLoading = true
            status.wrongReportData.message = this.feedbackContent
            try {
                const id = await sendWrongOCRFeedback(status.wrongReportData)
                this.feedbackVisible = false
                ElMessageBox({
                    type: 'success',
                    title: __('Thank you for your feedback'),
                    message: `${__('The data has been submitted and we will check and improve it as soon as possible.')} ID：${id || 0}`,
                })
            } catch (e) {}
            this.feedbackLoading = false
        },
    },
}
</script>

<template>
    <app-header @clickprocess="processWithTimeout" />
    <div class="app-main">
        <capture
            ref="captureDom"
            @start="processWithTimeout"
            @modify="onModify"
            @delete="onDelete"
            @reset="onReset"
            @feedback="onFeedback"
        />
        <el-dialog v-model="feedbackVisible" title="Feedback identification error" width="90%">
            <div class="feedback-desc">
                {{ __('Feedback identifying information will be sent to our server as follows.') }}
                <ul>
                    <li>- {{ __('The picture of the artifacts captured this time') }}</li>
                    <li>- {{ __('Your device screen resolution and dpi') }}</li>
                    <li>- {{ __('Local OCR recognition results and error correction attempts') }}</li>
                    <li>- {{ __('Notes') }}</li>
                </ul>
                {{ __('If you do not provide feedback to us, these contents will be removed after the next artifact is recognized.') }}
            </div>
            <el-input
                v-model="feedbackContent"
                type="textarea"
                :placeholder="__('Any special notes? You can also leave it blank.')"
            ></el-input>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="feedbackVisible = false">{{ __('Cancel') }}</el-button>
                    <el-button :loading="feedbackLoading" type="primary" @click="doFeedback">
                        {{ __('Send') }}
                    </el-button>
                </span>
            </template>
        </el-dialog>
    </div>
</template>
<style lang="scss">
@import '~@/styles/fonts.scss';
* {
    font-family: GenshinImpact;
    overflow: hidden;
}
@media only screen and (-webkit-min-device-pixel-ratio: 1.2) {
    .float {
        zoom: 0.85;
        font-size: 12px;
    }
    .title {
        font-size: 12px;
    }
}
@media only screen and (-webkit-min-device-pixel-ratio: 1.5) {
    .float {
        zoom: 0.72;
        font-size: 13px;
    }
    .title {
        font-size: 12px;
    }
}
.el-overlay {
    top: 30px;
    left: 2px;
    right: 2px;
    bottom: 2px;
    height: auto;
}
.el-message-box {
    max-width: 85%;
}
</style>
<style lang="scss" scoped>
.app-main {
    position: absolute;
    top: 30px;
    left: 2px;
    right: 2px;
    bottom: 2px;
}
.feedback-desc {
    margin-top: -30px;
    margin-bottom: 15px;
    ul {
        margin: 7px;
        padding: 0;
        padding-left: 10px;
        li {
            list-style: none;
        }
    }
}
</style>
