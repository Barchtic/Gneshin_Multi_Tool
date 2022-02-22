<script>
import { __ } from '@/i18n'
import { bus, STATUS } from '../bus'
export default {
    emits: ['pagedown', 'detectonce', 'startauto'],
    computed: {
        bus: () => bus,
        STATUS: () => STATUS,
        statusText() {
            switch (bus.status) {
                case STATUS.CAPTURE:
                    return 'Detecting'
                case STATUS.CLICK:
                case STATUS.JOYSTICK:
                    return 'Switching'
                case STATUS.PAGING:
                    return 'Paging'
                default:
                    return 'Preparing'
            }
        },
        numberText() {
            const translated = __('Current page %1 Total %2 / %3', bus.currentCount, bus.checkedCount, bus.totalCount)
            return translated.split(/(\d+)/)
        },
        numberTextHandle() {
            const translated = __('Recognized %1', bus.checkedCount)
            return translated.split(/(\d+)/)
        },
    },
}
</script>
<template>
    <div class="actions">
        <div class="left-btn">
            <button v-if="bus.status === STATUS.CAPTURE && !bus.auto" size="mini">
                <i class="el-icon-loading"></i>
                {{ __('Detecting') }}
            </button>
            <button v-if="bus.status !== STATUS.CAPTURE && !bus.auto" size="mini" @click="$emit('detectonce')">
                <i class="el-icon-location-information"></i>
                {{ __('Detect') }}
            </button>
            <button v-if="!bus.intro && !bus.auto" size="mini" @click="$emit('startauto')">
                <i class="el-icon-s-flag"></i>
                {{ __('Start switching') }}
            </button>
            <div v-if="bus.auto" class="autotext">
                <i class="el-icon-loading"></i>
                {{ __(statusText) }}{{ __('Press the hotkey (~) to stop') }}
            </div>
        </div>
        <div class="right-status">
            <div v-if="bus.status === STATUS.ERROR" class="error">{{ __('Detection Failure') }}</div>
            <div v-else>
                <div v-if="bus.status === STATUS.JOYSTICK">
                    {{ __('Handle Mode') }}: {{ numberTextHandle[0] }} <span class="num">{{ numberTextHandle[1] }}</span>
                    {{ numberTextHandle[2] }}
                </div>
                <div v-else>
                    {{ numberText[0] }}
                    <span class="num">{{ numberText[1] }}</span>
                    {{ numberText[2].trim().replace('  ', '&nbsp;&nbsp;&nbsp;') }}
                    <span class="num">{{ numberText[3] }}</span
                    >{{ numberText[4] }}<span class="num">{{ numberText[5] }}</span
                    >{{ numberText[6] }}
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.actions {
    background: #007acc;
    position: absolute;
    top: 30px;
    left: 2px;
    right: 2px;
    height: 50px;
    box-sizing: border-box;
    .right-status {
        position: absolute;
        right: 10px;
        top: 0;
        bottom: 0;
        line-height: 50px;
        color: #fff;
        font-size: 17px;
        .num {
            font-size: 1.5rem;
        }
    }
    .left-btn {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        .autotext {
            position: absolute;
            left: 10px;
            top: 0;
            bottom: 0;
            line-height: 50px;
            color: #fff;
            font-size: 17px;
            width: 50vw;
        }
        button {
            width: 135px;
            outline: 0;
            background: transparent;
            color: #fff;
            height: 100%;
            display: inline-block;
            border: 0;
            font-size: 17px;
            padding: 0px 15px;
            cursor: pointer;
            user-select: none;
            &:hover {
                background: rgba(255, 255, 255, 0.15);
            }
        }
    }
}
</style>
