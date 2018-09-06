const ERRORS = require('./errors')
const COUNTDOWN = 60 * 1000     // 每局每个玩家有 60 秒时间，超时判负

// 使用一个定时器更新所有游戏实例
const gameMap = new Map()            // 保存所有游戏实例
let lastTimestamp = Date.now()
setInterval(() => {
  const now = Date.now()
  const delta = now - lastTimestamp
  lastTimestamp = now
  gameMap.forEach(game => game.update(delta))
}, 200)

/**
 * 创建一场井字过三关游戏
 */
class TicTacToe {
  /**
   * 实例化 TicTacToe 所需提供的配置的结构
   * @typedef {Object} TicTacToeOption
   * @property {Function} onGameover 游戏结束事件回调，必填
   * @property {Function} [onGameStart] 游戏开始事件
   * @property {Function} [onNextRound] 轮到下一名玩家落子
   * @property {number} [countdown] 每名玩家每盘的总游戏时长，超时判负
   */

  /**
   * 创建一个井字过三关游戏
   * @param {TicTacToeOption} option 游戏配置
   */
  constructor (roomId, players) {
    this.players = players
    this.playing = false
    this.firsthand = Math.round(Math.random())        // 随机先手
    this.currentPlayer = this.firsthand
    this.board = [ 
      [ -1, -1, -1 ], [ -1, -1, -1 ], [ -1, -1, -1 ]  // 0 为未放置棋子，-1/1 为第一位玩家、第二位玩家的棋子
    ]
    this.countdowns = [ COUNTDOWN, COUNTDOWN ]
  }

  static createGame (roomId, players) {
    const game = new TicTacToe(roomId, players)
    game.id = roomId                                        // 分配 id
    gameMap.set(roomId, game)                               // 把新建的游戏加入到全部游戏列表中，以集中更新游戏时间
    return game
  }

  static getGame (id) {
    return gameMap.get(id)
  }

  getCurrentPlayer () {
    return this.players[ this.currentPlayer ]
  }

  /**
   * 更新本游戏超时情况
   * @param {number} delta 距离上一次调用过去的毫秒数
   */
  update (delta) {
    if (!this.playing) return
    this.countdowns[ this.currentPlayer ] -= delta

    if (this.countdowns[ this.currentPlayer ] <= 0) {
      this._gameover(1 - this.currentPlayer)         // 超时对方获胜
    }
  }

  /**
   * @typedef {Array<number>} Position 表示棋盘位置，应有两个 number 分别代表列和行，范围 0 - 2
   */

  /**
   * 检查一组棋盘坐标上的棋子是否属于同一玩家，未落子坐标不属于任何玩家
   * @param {Array<Position>} positions 棋盘坐标列表
   */
  _isSameKindPiece (positions) {
    const firstPiece = this.board[positions[0][0]][positions[0][1]]
    if (firstPiece !== 0 && firstPiece !== 1) return false

    for (let i = 1; i < positions.length; i++) {
      if (this.board[positions[i][0]][positions[i][1]] !== firstPiece) {
        return false
      }
    }

    return true
  }

  /**
   * 检查是否已经形成胜局
   */
  _isGameover () {
    const isWin = (
      this._isSameKindPiece([ [ 0, 0 ], [ 0, 1 ], [ 0, 2 ] ]) ||
      this._isSameKindPiece([ [ 1, 0 ], [ 1, 1 ], [ 1, 2 ] ]) ||
      this._isSameKindPiece([ [ 2, 0 ], [ 2, 1 ], [ 2, 2 ] ]) ||

      this._isSameKindPiece([ [ 0, 0 ], [ 1, 0 ], [ 2, 0 ] ]) ||
      this._isSameKindPiece([ [ 0, 1 ], [ 1, 1 ], [ 2, 1 ] ]) ||
      this._isSameKindPiece([ [ 0, 2 ], [ 1, 2 ], [ 2, 2 ] ]) ||

      this._isSameKindPiece([ [ 0, 0 ], [ 1, 1 ], [ 2, 2 ] ]) ||
      this._isSameKindPiece([ [ 0, 2 ], [ 1, 1 ], [ 2, 0 ] ])
    )
    // 平局：在没有获胜的情况下检查空格数量，如果等于 0 则为平局
    const isEven = !isWin && (
      0 === this.board.reduce((available, lines) => {
        return available + lines.reduce((available, piece) => {
          return piece === -1 ? available + 1 : available
        }, 0)
      }, 0)
    )

    if (isEven) return 'even'
    if (isWin) return 'win'
  }

  start () {
    this.playing = true
    TicTacToe.onGameStart(this, this.getCurrentPlayer())
  }

  /**
   * 落子
   * @param {number} col 范围 0-2
   * @param {number} row 范围 0-2
   */
  placePiece (row, col) {
    const lastAction = { row, col }
    const hasPiece = this.board[ row ][ col ] != -1
    if (hasPiece) throw ERRORS.CAN_NOT_PLACE

    this.board[ row ][ col ] = this.currentPlayer

    const result = this._isGameover()
    if (result === 'win') {
      this._gameover(this.currentPlayer, lastAction)
    } else if (result === 'even') {
      this._gameover(null, lastAction)
    } else {
      this.currentPlayer = 1 - this.currentPlayer
      TicTacToe.onNextRound(this, lastAction)
    }
  }

  /**
   * 游戏结束
   * @param winner
   * @private
   */
  _gameover (winner, lastAction) {
    const winnerId = typeof winner === 'number' && this.players[winner]
    TicTacToe.onGameOver(this, winnerId, lastAction)
    this.destroy()
  }

  /**
   * 销毁游戏
   */
  destroy () {
    gameMap.delete(this.id)
  }

  /**
   * 获取指定玩家角度的游戏信息，0 为自己，1 为对手
   * @param playerId
   * @return {{currentPlayer: *, board: (number[][]|*[]), id: *}}
   */
  getInfoForPlayer (playerId) {
    const selfIndex = this.players.indexOf(playerId)
    const countdowns = [
      this.countdowns[ selfIndex ],         // 自己的倒计时
      this.countdowns[ 1 - selfIndex ],     // 对手的倒计时
    ]
    const firsthand = this.firsthand === selfIndex ? 0 : 1
    const currentPlayer = this.currentPlayer === selfIndex ? 0 : 1
    const selfPiece = selfIndex
    const board = this.board.map(lines => {
      return lines.map(piece => {
        switch (piece) {
          case selfPiece:
            return 0
          case -1:
            return -1
          default:
            return 1
        }
      })
    })
    return {
      currentPlayer,
      board,
      countdowns,
      firsthand,
      id: this.id,
    }
  }
}

module.exports = TicTacToe