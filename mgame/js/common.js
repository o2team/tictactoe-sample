/**
 * 公共函数
 */

// 视觉稿中关于棋盘位置的数值，用于 addPieces 函数中
const GRID_ORIGIN_LEFT = 139
const GRID_ORIGIN_TOP = 505
const GRID_GAP = 184

/**
 * 检查一组位置是否是同一个玩家的棋子
 */
function checkSamePiece(board) {
  return (combo) => {
    const getPiece = (i) => board[combo[i][0]][combo[i][1]]
    // 获取第一个位置的棋子
    const firstPiece = getPiece(0)
    // 如果该位置没有棋子，则判该组棋子不属于同一玩家
    if (firstPiece === -1) return false
    // 判断所有棋子是否都与第一个棋子相同
    for (let i = 1; i < combo.length; i++) {
      if (getPiece(i) !== firstPiece) return false
    }
    return true
  }
}

/**
 * 创建蒙层
 */
function addShadow() {
  // 创建一个 Phaser 的 graphics ，用代码绘制蒙层
  const shadow = common.curState().add.graphics(0, 0)
  // 开始填充
  shadow.beginFill()
  // 尺寸选择 (0, 0) 到 (WIDTH, HEIGHT) 以遮住全屏幕
  shadow.drawRect(0, 0, WIDTH, HEIGHT)
  // 调整为半透明
  shadow.alpha = 0.8
  // 启用交互，防止点击穿透到后方界面
  shadow.inputEnabled = true
  return shadow
}

const common = {
  /**
   * 获取当前的场景
   */
  curState: () => go.game.state.getCurrentState(),

  /**
   * 绘制按钮
   */
  addBtn: ({ x, y, callback, context, text }) => {
    // 向当前场景添加按钮
    const btn = common.curState().add.button(x, y, 'btn', callback, context, 0)
    // 创建文本标签
    const label = common.curState().make.text(btn.width / 2, btn.height / 2, text, {
      font: "36px", fill: "#ff5420"
    })
    // 将锚点定位在标签中间
    label.anchor = { x: 0.5, y: 0.5 }
    // 将标签加入到按钮中
    btn.addChild(label)
    return btn
  },

  /**
   * 绘制头像
   */
  addAvatar: ({ x, y, avatarKey, size = 128 }) => {
    // 先绘制头像
    const avatar = common.curState().add.image(x, y, avatarKey)
    // 设置为指定的尺寸
    avatar.width = size
    avatar.height = size
    // 设置圆形遮罩
    const mask = common.curState().add.graphics(x, y)
    mask.beginFill()
    mask.drawCircle(size / 2, size / 2, size - 8, size - 8)
    avatar.mask = mask
    // 绘制头像框
    const avatarBorder = common.curState().add.image(x, y, 'avatar')
    avatarBorder.width = size
    avatarBorder.height = size
  },

  /**
   * 绘制对战信息并且提供渲染倒计时回调
   */
  addBattleInfo: ({ meAvatar, meName, opponentAvatar, opponentName }) => {
    // 绘制头像
    go.common.addAvatar({ x: 47, y: 199, avatarKey: meAvatar })
    go.common.addAvatar({ x: 585, y: 199, avatarKey: opponentAvatar })

    // 绘制昵称
    common.curState().add.text(183, 223, meName, {
      font: "30px", fill: "#fff"
    })
    const opponentNameLabel = common.curState().add.text(578, 223, opponentName, {
      font: "30px", fill: "#fff"
    })
    opponentNameLabel.anchor.x = 1

    // 双方棋子类型（自己永远是圈，对面永远是叉，优化工作留做作业）
    const mePiece = common.curState().add.image(184, 271, 'o')
    const opponentPiece = common.curState().add.image(545, 271, 'x')
    mePiece.width = 28
    mePiece.height = 28
    opponentPiece.width = 28
    opponentPiece.height = 28

    // 倒计时文本标签
    const meCDLabel = common.curState().add.text(228, 271, '', {
      font: '24px', fill: '#fff'
    })
    const opponentCDLabel = common.curState().add.text(532, 271, '', {
      font: '24px', fill: '#fff'
    })
    // 对手的倒计时是右对齐的，锚点设置到最右边，宽度改变时就可以右边不动向左适应。
    opponentCDLabel.anchor.x = 1

    // 返回用于更新倒计时标签的函数
    return (meCD, opponentCD) => {
      meCDLabel.text = `${Math.round(meCD / 1000)}S`
      opponentCDLabel.text = `${Math.round(opponentCD / 1000)}S`
    }
  },

  /**
   * 绘制棋盘并且提供点击事件回调
   */
  addPieces: (callback) => {
    // 创建棋子
    const pieces = [
      [[0, 0], [0, 1], [0, 2]],
      [[1, 0], [1, 1], [1, 2]],
      [[2, 0], [2, 1], [2, 2]],
    ].map((rows) => {
      // 逐行创建棋子
      return rows.map((coords) => {
        // 该棋子所在行列
        const row = coords[0]
        const col = coords[1]
        // 创建按钮作为棋子
        const piece = common.curState().add.button(
          // 计算棋子应放置的位置
          GRID_ORIGIN_LEFT + col * GRID_GAP,
          GRID_ORIGIN_TOP + row * GRID_GAP,
          // 这里只是随便选一种棋子的图片来撑开点击空间
          // 后面会把棋子透明度设为 0 就变成未落子状态了
          'o',
          // 棋子被点击回调
          () => {
            // 如果点击了未落子位置才响应
            if (piece.alpha === 0)
              callback(row, col)
          },
          null, 0)
        // 将刚创建的棋子设为透明，表示目前是未落子状态
        piece.alpha = 0
        return piece
      })
    })

    // 返回用于落子的函数，player 可以指定落子类型
    return (row, col, player) => {
      // 获取指定坐标的棋子
      const piece = pieces[row][col]
      // 根据 player 决定指定棋子的类型
      if (player === 0 || player === 1) {
        piece.loadTexture(player === 0 ? 'o' : 'x')
        piece.alpha = 1
      // player 为非法值视为取走该处棋子
      } else {
        piece.alpha = 0
      }
    }
  },

  /**
   * 检查传入的棋盘是否形成胜局
   */
  checkWin: (board) => {
    // 构造所有胜利情况组合
    let winCombo = []
    winCombo = winCombo.concat([0, 1, 2].map((row) => [[row, 0], [row, 1], [row, 2]]))
    winCombo = winCombo.concat([0, 1, 2].map((col) => [[0, col], [1, col], [2, col]]))
    winCombo.push([[0, 0], [1, 1], [2, 2]])
    winCombo.push([[0, 2], [1, 1], [2, 0]])
    // 调用 checkSamePiece 检查传入的棋盘是否满足任一一种情况
    return winCombo.some(checkSamePiece(board))
  },

  /**
   * 检查是否平局
   */
  checkDraw: board => board.every(row => row.every(piece => piece !== -1)),

  /**
   * 绘制游戏结果层
   */
  showResult: ({ result, meName, opponentName, meAvatar, opponentAvatar, callback }) => {
    addShadow()  // 绘制蒙层

    // 创建对弈结果：'win' 'lose' or 'draw'
    common.curState().add.image(189, 285, result)
    // 创建头像背景框
    common.curState().add.image(119, 450, 'avatars')
    // 创建玩家头像
    common.addAvatar({
      x: 196,
      y: 482,
      avatarKey: meAvatar,
      size: 138
    })
    // 创建对手头像
    common.addAvatar({
      x: 426,
      y: 482,
      avatarKey: opponentAvatar,
      size: 138
    })
    // 玩家昵称
    const meLabel = common.curState().add.text(263, 642, meName, {
      font: "30px", fill: "#fff"
    })
    // 居中
    meLabel.anchor.x = 0.5
    // 对手昵称
    const opponentLabel = common.curState().add.text(494, 642, opponentName, {
      font: "30px", fill: "#fff"
    })
    // 居中
    opponentLabel.anchor.x = 0.5
    // 创建胜利方头像下面的彩带，平局没有彩带
    result !== 'draw' && common.curState().add.image(result === 'win' ? 162 : 393, 586, 'bunting')

    // 创建回到首页按钮
    common.addBtn({
      x: 248,
      y: 800,
      callback,
      text: '回到首页'
    })
  },

  alertYourTurn: () => {
    // 提醒玩家落子
    wx.showToast({
      title: '轮到你下了',
    })
    wx.vibrateShort()
  }
}

module.exports = common
