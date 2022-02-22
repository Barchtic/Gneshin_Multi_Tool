<script>
export default {
    emits: ['start'],
}
</script>
<template>
    <section class="intro">
        <div class="left"></div>
        <div class="right">
            {{
                __(
                    'Open Genshin in window mode, open the artifact page and resize this window to fit the artifact. Then use the button below or hotkey (~) to start.',
                )
            }}
            <br />
            <el-button @click="$emit('start')">{{ __('Start') }}</el-button>
        </div>
    </section>
</template>

<style lang="scss" scoped>
.right {
    color: #333;
    position: absolute;
    top: 0;
    right: 0;
    width: 60%;
    bottom: 0;
    padding: 20px;
    box-sizing: border-box;
    text-align: left;
    button {
        width: 100%;
    }
}
</style>
