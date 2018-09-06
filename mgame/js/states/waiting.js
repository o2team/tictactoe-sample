/**
 * 等待对手界面（仅创建房间者有此步骤）
 */

/**
 * 取消对战按钮的回调函数
 */
function cancelBattle() {
  go.server.leaveRoom(() => {
    // 离开房间成功后跳转主菜单场景
    go.game.state.start('menu')
  })
}

class Waiting extends Phaser.State {
  create() {
    // 绘制背景
    this.add.image(0, 0, 'bg_waiting')

    // 绘制玩家头像
    go.common.addAvatar({
      x: 115,
      y: 816,
      avatarKey: go.userInfo.avatarUrl || 'avatar_unknow',
      size: 168
    })

    // 创建取消对战按钮
    go.common.addBtn({
      x: 248,
      y: 700,
      text: '取消对战',
      callback: cancelBattle,
    })

    // 等待对手加入房间
    go.server.once('opponent joined', (opponent) => {
      // 将对手的基本信息保存到 global object
      go.opponentInfo = opponent
    })

    // 等待游戏开始
    go.server.once('game start', (game) => {
      // 将对战初始状态保存到 global object
      go.battle = game
      // 跳转对战场景
      this.game.state.start('battle')
    })
  }
}

module.exports = Waiting
