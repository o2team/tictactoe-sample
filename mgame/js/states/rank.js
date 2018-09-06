/**
 * 排行榜
 */

function backToMenu() {
  go.game.state.start('menu')
}

class Rank extends Phaser.State {
  create() {
    // 获得开放数据域实例
    const openDataContext = wx.getOpenDataContext()

    // 绘制背景
    this.add.image(0, 0, 'bg_rank')

    // 透明的返回主菜单按钮，放在左上角背景图的返回位置
    const backButton = this.add.button(0, 155, 'btn', backToMenu)
    backButton.alpha = 0

    // 向开放数据域发送 rank 消息
    openDataContext.postMessage('rank')
  }

  /**
   * 将开放数据域绘制的排行榜绘制到上屏画布上
   */
  render() {
    // 获得开放数据域实例
    const openDataContext = wx.getOpenDataContext()
    // 获得离屏画布
    const sharedCanvas = openDataContext.canvas
    // 将离屏画布绘制到上屏画布
    // game.context 是 Phaser 的接口，用于获取 Phaser 正在使用的 canvas context
    this.game.context.drawImage(sharedCanvas, 0, 0)
  }
}

module.exports = Rank
