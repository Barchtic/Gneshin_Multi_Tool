<script lang="ts">
import { bus } from '@/App/bus'
import { defineComponent, PropType } from 'vue'
export default defineComponent({
    props: {
        show: {
            type: Boolean as PropType<boolean>,
            default: false,
        },
    },
    data() {
        return {
            sendErrorReports: true,
            sendWrongOCRReports: false,
        }
    },
    methods: {
        doSave() {
            bus.config.options.sendErrorReports = this.sendErrorReports
            bus.config.options.sendWrongOCRReports = this.sendWrongOCRReports
            bus.config.options.firstRun = false
        },
    },
})
</script>
<template>
    <el-dialog
        custom-class="fullscreen-dialog firstrun-dialog"
        :title="__('Genshin Multi Tool')"
        width="440px"
        :model-value="show"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        destroy-on-close
    >
        <div class="firstrun-box">
            <h4>
                {{ __('This is a toolbox for Genshin Impact featuring artifacts exporting and an interactive map.') }}
                <br />
                {{ __('There is something you need to check before we start.') }}
            </h4>

            <div class="opt">
                <el-switch v-model="sendErrorReports" :active-text="__('Send error reports to help us fixing bugs')"> </el-switch>
            </div>
            <div class="opt">
                <el-switch v-model="sendWrongOCRReports" :active-text="__('Show feedback button on OCR page')"> </el-switch>
            </div>
            <div class="opt small-txt">
                {{
                    __(
                        'You can change those settings anytime after saving in the Options page, but they will take effects after a reload. Besides these, this application checks for updates automatically everytime it starts. Clicking the button below means you agree what is written here.',
                    )
                }}
            </div>
        </div>
        <template #footer>
            <span class="dialog-footer">
                <el-button style="width: 100%" size="small" type="primary" @click="doSave">
                    {{ __('Save and Start') }}
                </el-button>
            </span>
        </template>
    </el-dialog>
</template>

<style lang="scss" scoped>
.firstrun-box {
    h4 {
        margin-top: -25px;
        font-weight: normal;
        margin-bottom: 20px;
    }
    .opt {
        margin-bottom: 10px;
    }
    .small-txt {
        font-size: 13px;
        padding: 10px 0;
        padding-top: 15px;
    }
}
</style>
<style lang="scss">
.firstrun-dialog .el-dialog__body {
    padding-bottom: 0;
}
</style>
