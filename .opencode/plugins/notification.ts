export const NotificationPlugin = async ({ $, client }) => {
  return {
    event: async ({ event }) => {
      switch(event.type) {
        case "session.start":
          await $`osascript -e 'display notification "OpenCode 会话已启动" with title "OpenCode"'`
          break
        case "task.start":
          await $`osascript -e 'display notification "任务开始: ${event.taskName}" with title "OpenCode"'`
          break
        case "task.complete":
          await $`osascript -e 'display notification "任务完成: ${event.taskName}" with title "OpenCode"'`
          break
        case "input.request":
          await $`osascript -e 'display notification "OpenCode 需要你的输入" with title "OpenCode"'`
          break
        case "session.error":
          await $`osascript -e 'display notification "任务出错: ${event.error}" with title "OpenCode"'`
          break
      }
    }
  }
}