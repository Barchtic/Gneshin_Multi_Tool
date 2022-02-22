<script>
import xss from 'xss'
import dayjs from 'dayjs'
import marked from 'marked'
import fsex from 'fs-extra'
import $set from 'lodash/set'
import { upgrade, getApphash, checkViGEmInstalled, openExternal } from '../../ipc'
import { bus } from '@/App/bus'
import { ipcRenderer } from 'electron'
import { latestRelease, checkPatch } from '@/api/upgrade'
import { ElLoading, ElMessageBox, ElNotification } from 'element-plus'
import { version_compare } from '@/plugins/version_compare'
import { EBuild } from '@/typings/config'
import { joystickStatus } from '@/ArtifactSwitch/ipc'
import { __ } from '@/i18n'
export default {
    async beforeRouteEnter(to, fr, next) {
        const joystick = await joystickStatus()
        next((vm) => {
            vm.joystick = joystick
        })
    },
    data() {
        return {
            clickTimes: 0,
            runtimeDebug: false,
            showUpgrade: false,
            newVersion: false,
            versionHTML: '',
            upgradeButtonLoading: false,
            joystick: false,
        }
    },
    computed: {
        bus() {
            return bus
        },
        options() {
            return bus.config.options
        },
        buildTime() {
            return dayjs(bus.config.build.timestamp).format('YYMMDDHHmm')
        },
    },
    methods: {
        opt(k, v) {
            $set(bus.config.options, k, v)
        },
        async checkUpgrade() {
            this.upgradeButtonLoading = true
            try {
                let buildType = ''
                if (bus.config.build?.type === EBuild.DEV) {
                    buildType = `.${bus.config.build?.timestamp}dev`
                } else if (bus.config.build?.type === EBuild.TES) {
                    buildType = `.${bus.config.build?.timestamp}beta`
                }
                const localVersion = bus.config.version + buildType
                const release = await latestRelease(localVersion, 'check')
                const cmp = version_compare(localVersion, release.version)
                console.log(localVersion, release.version, cmp)
                if (cmp < 0) {
                    this.newVersion = release
                    this.showUpgrade = true
                    this.versionHTML = xss(marked(release.content))
                } else {
                    ElNotification({
                        type: 'success',
                        title: this.__('You are already on the latest version'),
                    })
                }
            } catch (e) {}
            this.upgradeButtonLoading = false
        },
        async doUpgrade() {
            if (bus.config.build.type === 'DEV') {
                ElNotification({
                    type: 'info',
                    title: this.__('Autoupgrade is disabled in development mode'),
                })
                return
            }
            try {
                const virtualPath = 'C:\\cocogoat'
                await fsex.access(virtualPath)
            } catch (e) {
                /* 虚拟路径不存在，即当前为非单文件运行，此时不支持自动更新 */
                ElNotification({
                    type: 'info',
                    title: this.__('Auto upgrade is not supported in this wersion'),
                })
                return
            }
            this.showUpgrade = false
            ElLoading.service({ fullscreen: true, text: this.__('If you lie on the grass, you can feel the heartbeat of the world.') })
            const hash = await getApphash()
            console.log('appHash=', hash)
            let hasPatch = false
            let patchUrl = ''
            try {
                patchUrl = await checkPatch(this.newVersion.url, hash)
                hasPatch = true
            } catch (e) {
                console.log(e)
            }
            console.log('hasPatch=', hasPatch, patchUrl)
            upgrade(hasPatch ? patchUrl : this.newVersion.url.fullPackage, hasPatch)
        },
        clickVersion() {
            this.clickTimes++
            if (this.clickTimes >= 5) {
                this.runtimeDebug = true
            }
        },
        ctxVersion() {
            if (this.runtimeDebug) {
                ipcRenderer.send('devtoolsApp')
            }
        },
        doClearWindowStates() {
            bus.config.options.windowStates = {}
            ElNotification({
                type: 'success',
                title: this.__('Window Positions Data was Cleared'),
            })
        },
        doClearStorage() {
            ipcRenderer.send('clearStorageData', {
                name: 'persist:mihoyoMap',
                options: {
                    origin: 'https://webstatic.mihoyo.com',
                },
            })
            ElNotification({
                type: 'success',
                title: this.__('Login Information has been Cleared'),
            })
        },
        async doSetJoystick(val) {
            if (val) {
                if (await checkViGEmInstalled()) {
                    ipcRenderer.send('joystickInit')
                    this.joystick = true
                } else {
                    await ElMessageBox.confirm(
                        __('Please download and install the ViGEm driver (https://vigem.org/) to use the joystick emulation function.'),
                        __('Tips'),
                        {
                            confirmButtonText: __('Go to Downloads'),
                            cancelButtonText: __('Close'),
                            type: 'warning',
                        },
                    )
                    openExternal('https://vigem.org/')
                    return
                }
            } else {
                ipcRenderer.send('joystickStop')
                this.joystick = false
            }
        },
    },
}
</script>
<template>
    <teleport to="#app-title">
        <span>{{ __('Settings') }}</span>
    </teleport>
    <teleport to="#app-actions">
        <span class="version" @click="clickVersion" @contextmenu="ctxVersion">
            <span class="main"> v{{ bus.config.version }}</span
            ><small>_{{ bus.config.build?.type.toLowerCase() }}{{ buildTime }}</small>
        </span>
        <span class="upgrade-button">
            <el-badge is-dot class="item" :hidden="!bus.hasUpgrade" type="danger">
                <el-button
                    :loading="upgradeButtonLoading"
                    size="mini"
                    plain
                    icon="el-icon-position"
                    @click="checkUpgrade"
                >
                    <span>{{ __('Check for Updates') }}</span>
                </el-button>
            </el-badge>
        </span>
    </teleport>
    <el-dialog
        v-if="newVersion"
        v-model="showUpgrade"
        custom-class="upgrade-dialog"
        :title="`${__('New Version:')} v${newVersion.version}`"
        width="400px"
    >
        <section class="version-details">
            <h4>{{ newVersion.name }}</h4>
            <article class="md-render" v-html="versionHTML"></article>
        </section>
        <template #footer>
            <span class="dialog-footer" @click="doUpgrade">
                <el-button size="small" style="width: 100%" type="primary">{{ __('Update') }}</el-button>
            </span>
        </template>
    </el-dialog>
    <div class="page-main">
        <article>
            <el-form label-position="right" label-width="auto" size="small">
                <el-form-item :label="__(`Language`)">
                    <el-select v-model="$lang.lang">
                        <el-option value="en" label="简体中文"> Simplified Chinese </el-option>
                        <el-option v-for="(i, a) in $availableLocales" :key="a" :value="a" :label="i.__name">
                            {{ i.__name }}
                        </el-option>
                    </el-select>
                </el-form-item>
            </el-form>
        </article>
        <article>
            <h3>{{ __('Basic') }}</h3>
            <div class="content-desc">{{ __('These options will take effect after the program is restarted.') }}</div>
            <div class="content">
                <div class="opt">
                    <el-switch
                        :active-text="__('Send error logs to help us improve the process')"
                        :model-value="options.sendErrorReports"
                        @update:model-value="opt('sendErrorReports', $event)"
                    >
                    </el-switch>
                </div>
                <div class="opt">
                    <el-switch
                        :active-text="__('Enable OCR recognition error feedback function')"
                        :model-value="options.sendWrongOCRReports"
                        @update:model-value="opt('sendWrongOCRReports', $event)"
                    >
                    </el-switch>
                </div>
                <br />
                <el-form label-position="right" label-width="auto" size="small">
                    <el-form-item :label="__('Windows Positions Data')">
                        <el-button @click="doClearWindowStates">
                            {{ __('Clear Saved Windows Data') }}
                        </el-button>
                        <div class="form-desc">{{ __('This may be useful when you cant find the hover window.') }}</div>
                    </el-form-item>
                    <el-form-item :label="__('Login Information Data')">
                        <el-button @click="doClearStorage">
                            {{ __('Clear Saved Login Information') }}
                        </el-button>
                        <div class="form-desc">{{ __('This will remove saved login information, local map markers, etc.') }}</div>
                    </el-form-item>
                </el-form>
            </div>
        </article>
        <article>
            <h3>{{ __('Arifacts') }}</h3>
            <div class="content-desc">{{ __('The options below will take effects when you open recognizor or switcher next time.') }}</div>
            <div class="content">
                <el-form label-position="right" label-width="auto" size="small">
                    <el-form-item :label="__('Keep Identical Artifacts')">
                        <el-switch
                            :model-value="options.artifacts.keepSameArtifacts"
                            @update:model-value="opt('artifacts.keepSameArtifacts', $event)"
                        ></el-switch>
                        <div class="form-desc">{{ __('Enable this if you wish to keep artifacts with identical stats.') }}</div>
                    </el-form-item>
                    <el-form-item :label="__('Speedup Scrolling')">
                        <el-switch
                            :model-value="options.artifacts.fastScroll"
                            @update:model-value="opt('artifacts.fastScroll', $event)"
                        ></el-switch>
                        <div class="form-desc">
                            {{ __('Please disable this if some lines are skipped because of scrolling too fast or you are using cloud gaming platforms with a high latency.') }}
                        </div>
                    </el-form-item>
                    <el-form-item :label="__('Upgrade Detection')">
                        <el-switch
                            :model-value="options.artifacts.upgradeArtifacts"
                            @update:model-value="opt('artifacts.upgradeArtifacts', $event)"
                        ></el-switch>
                        <div class="form-desc">{{ __('Automatically Replace Upgraded Artifacts.') }}</div>
                        <div class="form-desc">{{ __('(May cause a very few number of artifacts skipped.)') }}</div>
                    </el-form-item>
                    <el-form-item :label="__('Standalone Switcher')">
                        <el-switch
                            :model-value="options.artifacts.preserveSwitcher"
                            @update:model-value="opt('artifacts.preserveSwitcher', $event)"
                        ></el-switch>
                        <div class="form-desc">{{ __('Enable this to use the switcher standalone or work with third party softwares.') }}</div>
                    </el-form-item>
                    <el-form-item :label="__('Auto Switching Delay')">
                        <el-input-number
                            :modelValue="options.artifacts.autoSwitchDelay"
                            :min="0"
                            :precision="1"
                            :step="0.1"
                            :max="30"
                            @update:model-value="opt('artifacts.autoSwitchDelay', $event)"
                        ></el-input-number>
                        {{ __('Seconds') }}
                        <div class="form-desc">
                            {{ __('The delay before switching to the next artifact after scanning one.') }}
                            <br />
                            {{ __('Useful if you want to check errors manually or use standalone switcher with other tools. ') }}
                        </div>
                    </el-form-item>
                </el-form>
            </div>
        </article>
        <article>
            <h3>
                {{ __('Joystick simulating') }}
            </h3>
            <div class="content">
                <el-form label-position="right" label-width="auto" size="small">
                    <el-form-item :label="__('Enable joystick simulating')">
                        <el-switch :model-value="joystick" @update:model-value="doSetJoystick"></el-switch>
                        <div class="form-desc">
                            {{ __('The program will simulate a Xbox Controller when this option is enabled, which will be used in the artifact switcher.') }}
                        </div>
                        <div class="form-desc">
                            {{ __('You need to enable this before starting the game. Then, set the \"Control Type\" to \"Controller\" in the game.') }}
                        </div>
                        <div class="form-desc">
                            {{
                                __(
                                    'To prevent loss of control of the game, these key mappings will be enabled:\nA: A, B: B, X:X, Y:Y, LT: Page Up; RT: Page Down; Menu: ESC; Joystick: Arrow Keys',
                                )
                            }}
                        </div>
                    </el-form-item>
                </el-form>
            </div>
        </article>
        <article>
            <h3>
                {{ __('About Us') }}
            </h3>
            <div class="content">
                <div class="opt title">{{ __('Genshin Multi Tool') }}</div>
                <div class="opt">{{ __('A simple toolbox for Genshin Impact with every line of code made by working overtime.') }}</div>
                <div class="opt">&copy; 2021 YuehaiTeam and BunnyHunter031</div>
            </div>
        </article>
    </div>
</template>

<style lang="scss" scoped>
h3 {
    font-weight: normal;
    padding-left: 5px;
    padding-bottom: 10px;
    border-bottom: 1px solid #ddd;
}
.content {
    padding: 5px;
    font-size: 13px;
    .opt {
        margin-bottom: 7px;
    }
    .title {
        font-size: 17px;
    }
    &::v-deep(.el-form-item__label) {
        color: #333;
    }
    &::v-deep(.el-form-item) {
        margin-bottom: 8px;
    }
}
.form-desc {
    margin-top: 6px;
    line-height: 17px;
    font-size: 13px;
}
.content-desc {
    padding-left: 5px;
    margin-top: -6px;
    margin-bottom: 6px;
    line-height: 17px;
    font-size: 13px;
}
.version {
    display: inline-block;
    margin-right: 23px;
    font-size: 13px;
}
.version-details {
    h4 {
        margin-bottom: 5px;
    }
}
.upgrade-button {
    display: inline-block;
    line-height: normal;
}
</style>
<style lang="scss">
.upgrade-dialog {
    .el-dialog__body {
        padding: 5px 20px;
        margin-top: -20px;
    }
}
</style>
