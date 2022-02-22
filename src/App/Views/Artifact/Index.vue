<script lang="ts">
import Artifact from './Components/Artifact.vue'
import { Artifact as ArtifactType } from '@/typings/Artifact'
import ArtifactEditPanel from './Components/EditPanel.vue'
import {
    openArtifactView,
    showSaveDialog,
    openExternal,
    checkDwmIsCompositionEnabled,
    checkVCRedistInstalled,
} from '../../ipc'
import { ElMessageBox, ElNotification } from 'element-plus'
import { artifactClear, artifactDelete, artifactPush, bus } from '@/App/bus'
import { convertAsMona } from '../../export/Mona'
import { convertAsMingyulab } from '../../export/Mingyulab'
// @ts-ignore
import monaToGO from '@mr-quin/mona_to_go'
import { clipboard } from 'electron'
import { defineComponent } from 'vue'
import fsex from 'fs-extra'

import { __ } from '@/i18n'
export default defineComponent({
    components: {
        Artifact,
        ArtifactEditPanel,
    },
    data() {
        return {
            showEdit: false,
            editData: this.createEmptyArtifact(),
            isEdit: false,
            selectedIds: [] as number[],
        }
    },
    computed: {
        list() {
            return bus.artifacts
        },
    },
    methods: {
        createEmptyArtifact() {
            return {
                id: Date.now(),
                name: '',
                stars: 0,
                level: 0,
                main: {
                    name: '',
                    value: '',
                },
                sub: [],
                user: '',
            } as ArtifactType
        },
        async openArtifactView() {
            try {
                if (!(await checkVCRedistInstalled())) {
                    await ElMessageBox.confirm(
                        __(
                            'It seems that your system does not have the Microsoft Runtime Library (download at https://aka.ms/vs/16/release/vc_redist.x64.exe) installed, the recognition function will not work properly.',
                        ),
                        __('Hints'),
                        {
                            confirmButtonText: __('Go to Downloads'),
                            cancelButtonText: __('Keep Trying'),
                            type: 'warning',
                        },
                    )
                    openExternal('https://aka.ms/vs/16/release/vc_redist.x64.exe')
                    return
                }
            } catch (e) {}
            try {
                if (!(await checkDwmIsCompositionEnabled())) {
                    await ElMessageBox.confirm(__('Your system does not seem to have Aero enabled and the recognition feature may not work properly.'), __('Hints'), {
                        confirmButtonText: __('Confirm'),
                        cancelButtonText: __('Keep Trying'),
                        type: 'warning',
                    })
                    return
                }
            } catch (e) {}
            ElNotification({
                type: 'info',
                title: __('Opening Artifact Scanning Tool'),
                message: __('Please Make Sure Genshin Impact is running.'),
                duration: 5000,
            })
            openArtifactView()
        },
        doDelete(id: number) {
            artifactDelete(id)
        },
        doDeleteSelected() {
            this.selectedIds.forEach((id) => {
                artifactDelete(id)
            })
            this.selectedIds = []
        },
        doCreate() {
            this.editData = this.createEmptyArtifact()
            this.showEdit = true
            this.isEdit = false
        },
        doEdit(id: number) {
            for (let i of bus.artifacts) {
                if (i.id === id) {
                    this.editData = i
                    this.showEdit = true
                    this.isEdit = true
                }
            }
        },
        doEditSave(artifact: ArtifactType) {
            artifactPush(artifact)
            this.showEdit = false
        },
        doClear() {
            artifactClear()
            this.selectedIds = []
        },
        doSelect(id: number, status: boolean) {
            if (status) {
                this.selectedIds.push(id)
            } else {
                this.selectedIds = this.selectedIds.filter((e) => e !== id)
            }
        },
        getExport(format: string) {
            let artifacts = JSON.parse(JSON.stringify(bus.artifacts))
            if (this.selectedIds.length > 0) {
                artifacts = artifacts.filter((e: ArtifactType) => this.selectedIds.includes(e.id))
            }
            switch (format) {
                case 'GO':
                    return JSON.stringify(
                        {
                            version: 0,
                            characterDatabase: {},
                            artifactDatabase: monaToGO(convertAsMona(artifacts), 0, 3),
                            artifactDisplay: {
                                filterArtSetKey: '',
                                filterStars: [3, 4, 5],
                                filterLevelLow: 0,
                                filterLevelHigh: 20,
                                filterSlotKey: '',
                                filterMainStatKey: '',
                                filterSubstats: ['', '', '', ''],
                                filterLocation: '',
                                filterLocked: '',
                                ascending: false,
                                sortType: 'quality',
                                maxNumArtifactsToDisplay: 50,
                                effFilter: [
                                    'hp',
                                    'hp_',
                                    'atk',
                                    'atk_',
                                    'def_',
                                    'def',
                                    'eleMas',
                                    'enerRech_',
                                    'critRate_',
                                    'critDMG_',
                                ],
                            },
                            characterDisplay: {},
                            buildsDisplay: {},
                        },
                        null,
                        4,
                    )
                case 'Mingyulab':
                    return JSON.stringify(convertAsMingyulab(artifacts), null, 4)
                default:
                    return JSON.stringify(convertAsMona(artifacts), null, 4)
            }
        },
        doExport(format: string) {
            clipboard.writeText(this.getExport(format))
            ElNotification({
                type: 'success',
                title: __('Export Successful'),
                message: __('Results Copied to Clipboard.'),
            })
        },
        async doExportToFile(format: string) {
            try {
                const { filePath, canceled } = await showSaveDialog({
                    title: __('Export'),
                    filters: [{ name: 'JSON Files', extensions: ['json'] }],
                })
                if (canceled || !filePath) return
                const convertedJson = this.getExport(format)
                await fsex.writeFile(filePath, convertedJson)
                ElNotification({
                    type: 'success',
                    title: __('Export Successful'),
                })
            } catch (e) {
                console.log(e)
            }
        },
    },
})
</script>
<template>
    <teleport to="#app-title"> {{ __('Artifacts') }} </teleport>
    <teleport to="#app-actions">
        <div class="actions">
            <el-dropdown class="header-plain-dropdown" size="mini" split-button @click="doExport">
                {{ __(selectedIds.length > 0 ? 'Export Selected' : 'Export') }}
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item disabled class="export-title">
                            {{ __('Genshin Artifact Optimizer') }}
                        </el-dropdown-item>
                        <el-dropdown-item @click="doExport('Mona')">{{ __('Copy') }}</el-dropdown-item>
                        <el-dropdown-item @click="doExportToFile('Mona')">{{ __('To File') }}</el-dropdown-item>
                        <el-dropdown-item divided disabled class="export-title">
                            {{ __('Mingyulab') }}
                        </el-dropdown-item>
                        <el-dropdown-item @click="doExport('Mingyulab')">{{ __('Copy') }}</el-dropdown-item>
                        <el-dropdown-item @click="doExportToFile('Mingyulab')">{{ __('To File') }}</el-dropdown-item>
                        <el-dropdown-item divided disabled class="export-title">
                            {{ __('Genshin Optimizer') }}
                        </el-dropdown-item>
                        <el-dropdown-item @click="doExport('GO')">{{ __('Copy') }}</el-dropdown-item>
                        <el-dropdown-item @click="doExportToFile('GO')">{{ __('To File') }}</el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown>
            <template v-if="selectedIds.length <= 0">
                <el-button size="mini" plain icon="el-icon-plus" @click="doCreate">{{ __('Add') }}</el-button>
                <el-popconfirm
                    :confirmButtonText="__('Yes')"
                    :cancelButtonText="__('Later')"
                    icon="el-icon-warning"
                    :title="__('Do you really want to delete all?')"
                    confirmButtonType="danger"
                    @confirm="doClear"
                >
                    <template #reference>
                        <el-button size="mini" type="danger" plain icon="el-icon-delete">{{ __('Empty') }}</el-button>
                    </template>
                </el-popconfirm>
            </template>
            <template v-else>
                <el-button size="mini" plain icon="el-icon-remove-outline" @click="selectedIds = []">
                    {{ __('Unselect') }}
                </el-button>
                <el-button size="mini" type="danger" plain icon="el-icon-delete" @click="doDeleteSelected">
                    {{ __('Delete selected') }}
                </el-button>
            </template>
            <el-button size="mini" type="primary" plain icon="el-icon-aim" @click="openArtifactView">
                {{ __('Identification') }}
            </el-button>
        </div>
    </teleport>
    <div class="page-main">
        <artifact
            v-for="i in list"
            :key="i.id"
            :artifact="i"
            :selected="selectedIds.includes(i.id)"
            @update:selected="doSelect(i.id, $event)"
            @delete="doDelete"
            @edit="doEdit"
        />
        <div v-if="list.length <= 0" class="emptyState">
            <el-empty :description="__('It is really empty here ...')"></el-empty>
        </div>
    </div>
    <artifact-edit-panel
        v-model:show="showEdit"
        :title="__(isEdit ? 'Edit Artifacts' : 'Add Artifacts')"
        :model-value="editData"
        @update:model-value="doEditSave"
    />
</template>

<style lang="scss" scoped>
.page-main {
    width: 100%;
    height: 100%;
}
.emptyState {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}
.export-title {
    cursor: default !important;
}
</style>
