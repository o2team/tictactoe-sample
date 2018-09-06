/**
 * 好友对战
 */

function over(result) {
  go.common.showResult({
    result,
    meName: go.userInfo.nickName,
    meAvatar: go.userInfo.avatarUrl || 'avatar_unknow',
    opponentName: go.opponentInfo.nickName,
    opponentAvatar: go.opponentInfo.avatarUrl || 'avatar_unknow',
    callback: () => {
      go.game.state.start('menu')
    }
  })
}

class Battle extends Phaser.State {
  constructor() {
    super()
    this.handleMyTurn = this.handleMyTurn.bind(this)
    this.handleGameOver = this.handleGameOver.bind(this)
    this.handleResume = this.handleResume.bind(this)
  }

  /**
   * 画背景、玩家信息
   */
  renderInfo() {
    this.add.image(0, 0, 'bg_playing')
    const renderCD = go.common.addBattleInfo({
      meAvatar: go.userInfo.avatarUrl || 'avatar_unknow',
      meName: go.userInfo.nickName,
      opponentAvatar: go.opponentInfo.avatarUrl || 'avatar_unknow',
      opponentName: go.opponentInfo.nickName,
    })

    // 更新 CD 并重绘
    let last = Date.now()
    const cdintervalId = setInterval(() => {
      const current = Date.now()
      const delta = current - last
      last = current
      const updatedCD = go.battle.countdowns[go.battle.currentPlayer] - delta
      go.battle.countdowns[go.battle.currentPlayer] = updatedCD > 0 ? updatedCD : 0
      renderCD(go.battle.countdowns[0], go.battle.countdowns[1])
    }, 500)
    this.stopCountdown = () => clearInterval(cdintervalId)
  }

  /**
   * 初始化棋盘
   */
  initBoard() {
    this.setPiece = go.common.addPieces((row, col) => {
      // 玩家落子
      if (go.battle.currentPlayer !== 0) return
      // 修改执子玩家为对手
      go.battle.currentPlayer = 1
      // 更新棋盘状态
      go.battle.board[row][col] = 0
      // 渲染棋盘
      this.renderBoard()
      // 向服务器发送落子消息
      go.server.placePiece(row, col)
    })
  }

  /**
   * 渲染棋盘
   */
  renderBoard() {
    // 将 go.battle.board 所代表的棋盘状态使用 this.setPiece 同步到界面上
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        this.setPiece(row, col, go.battle.board[row][col])
      }
    }
  }

  /**
   * 处理“轮到玩家落子”消息
   */
  handleMyTurn(game) {
    // 更新棋盘状态
    go.battle = game
    // 渲染最新的棋盘
    this.renderBoard()
    // 告知轮到玩家了
    go.common.alertYourTurn()
  }

  /**
   * 处理“游戏结束”消息
   */
  handleGameOver(game) {
    // 停止倒计时
    this.stopCountdown()
    // 更新并渲染棋盘
    go.battle = game
    this.renderBoard()
    // 显示游戏结果蒙层
    over(game.result)
  }

  /**
   * 处理恢复游戏状态消息
   */
  handleResume(resumeData) {
    if (!resumeData.game) {
      this.game.state.start('menu')
      return
    }

    go.battle = resumeData.game
    this.renderBoard()
  }

  /**
   * Phaser 用于预加载的生命周期
   */
  preload() {
    // 若对手有头像地址且头像并未预加载
    const hasAvatar = go.opponentInfo.avatarUrl !== ''
    const avatarNotLoaded = !this.game.cache.checkImageKey(go.opponentInfo.avatarUrl)
    if (hasAvatar && avatarNotLoaded) {
      // 则进行预加载
      this.load.image(go.opponentInfo.avatarUrl, go.opponentInfo.avatarUrl)
    }
  }

  create() {
    // 渲染对战双方信息
    this.renderInfo()
    // 初始化棋盘
    this.initBoard()
    // 根据 go.battle.board 渲染棋盘
    this.renderBoard()

    // 提示先手玩家
    if (go.battle.currentPlayer === 0) {
      go.common.alertYourTurn()
    }

    // 处理重连消息
    go.server.on('game resume', this.handleResume)

    // 处理我的回合消息
    go.server.on('your turn', this.handleMyTurn)

    // 处理游戏结束消息
    go.server.once('game over', this.handleGameOver)
  }

  /**
   * 离开对战场景时
   */
  shutdown() {
    // 停止倒计时
    this.stopCountdown()
    // 停止监听一系列消息
    go.server.off('game resume', this.handleResume)
    go.server.off('your turn', this.handleMyTurn)
    go.server.off('game over', this.handleGameOver)
    // 清空 go 中关于本次对局的状态
    go.battle = null
  }
}

module.exports = Battle
