/**
 * 主菜单
 */

/**
 * 单机练习按钮回调
 */
function practice() {
  go.game.state.start('practice')
}

/**
 * 好友对战按钮回调
 */
function battle() {
  if (!go.server.socket.connected) return
  go.server.createRoom((roomId) => {
    // 创建房间成功，准备游戏
    go.server.ready()

    // 发出带有房间 ID 的邀请消息
    wx.shareAppMessage({
      title: '让我们来一场紧张刺激而又健康益智的井字大作战吧！',
      imageUrl: 'images/share.png',
      query: `roomId=${roomId}`
    })

    // 跳转等待对手场景
    go.game.state.start('waiting')
  })
}

/**
 * 排行榜按钮回调
 */
function rank() {
  go.game.state.start('rank')
}

/**
 * 添加主菜单
 */
function addMenu() {
  [
    // x    y     按钮文本    回调函数
    [  248, 750,  "单机练习", practice],
    [  248, 900,  "好友约战", battle],
    [  248, 1050, "好友排行", rank],
  ].map((btnConfig) => {
    // 调用 common 中的 addBtn 函数创建按钮
    go.common.addBtn({
      x: btnConfig[0],
      y: btnConfig[1],
      text: btnConfig[2],
      callback: btnConfig[3],
    })
  })
}

class Menu extends Phaser.State {
  constructor() {
    super()
    this.handleOnShow = this.handleOnShow.bind(this)
    this.handleGameStart = this.handleGameStart.bind(this)
  }

  initMenu() {
    // 监听 onShow 事件，以允许用户最小化小游戏后通过点击邀请卡片加入房间
    wx.onShow(this.handleOnShow)
    // 显示主菜单
    addMenu()
    // 显示游戏圈
    go.gameClub.show()
  }

  /**
   * wx.onShow 的回调
   */
  handleOnShow({ query }) {
    // 游戏恢复前台
    if (query && query.roomId) {
      // 若是通过点击附带房间信息的卡片恢复前台，则加入该房间
      go.launchRoomId = query.roomId
      // 检查 socket io 连接状态
      if (go.server.socket.connected) {
        // 若连接正常，加入房间
        this.joinRoom()
      } else {
        // 否则确保在重连成功后加入房间
        go.server.once('game resume', () => {
          this.joinRoom()
        })
      }
    }
  }

  /**
   * game start 事件回调
   */
  handleGameStart(game) {
    // 游戏开始，保存对战状态
    go.battle = game
    // 跳转对战场景
    this.game.state.start('battle')
  }

  /**
   * 加入房间（go.launchRoomId 指定的房间 ID）
   */
  joinRoom() {
    // 监听游戏开始事件
    go.server.once('game start', this.handleGameStart)
    // 加入 go.launchRoomId 制定的游戏房间
    go.server.joinRoom(go.launchRoomId, (err, res) => {
      if (err) {
        // 加入失败则不再监听游戏开始
        go.server.off('game start', this.handleGameStart)
        // 提示加入失败
        wx.showToast({
          title: '加入房间失败',
          icon: 'loading',
        })
        // 加入失败的话，也正常显示主菜单
        this.initMenu()
        return
      }
      // 准备游戏（双方都准备后，服务器就会发出 game start 消息）
      go.server.ready()
      // 保存对手基本信息
      go.opponentInfo = res.opponent
    })
    // 清空 launchRoomId 避免多次尝试加入
    go.launchRoomId = null
  }

  create() {
    // 背景图
    this.add.image(0, 0, 'bg_menu')

    if (go.launchRoomId) {
      // 有 go.launchRoomId ，说明是从邀请游戏卡片启动/唤起游戏，则加入该房间
      this.joinRoom((err) => {
        wx.showToast({
          title: '加入房间失败',
          icon: 'loading',
        })
        // 加入失败的话，也正常显示主菜单
        this.initMenu()
      })
    } else {
      // 否则显示主菜单
      this.initMenu()
    }
  }

  // 离开场景后
  shutdown() {
    // 停止监听 onShow
    wx.offShow(this.handleOnShow)
    // 停止监听 game start
    go.server.off('game start', this.handleGameStart)
    // 隐藏游戏圈
    go.gameClub.hide()
  }
}

module.exports = Menu
