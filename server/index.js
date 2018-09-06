const weapi = require('./weapi')
const fs = require('fs')
const Players = require('./players')
const TicTacToe = require('./TicTacToe')
const promisify = require('util').promisify
const config = require('./config')
const ERRORS = require('./errors')

/**
 * 为域名备案提供一个简单的页面，以放置备案号
 */
function serveIndex (req, res) {
  res.write(`
    <html>
    <head>
    <title>微信小游戏入门</title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    </head>
    <body>
    <header>
    <h1>《微信小游戏入门》</h1>
    </header>

    <ul>
      <li>掘金小册：<a href="">即将上架</a></li>
      <li>配套代码库：<a href="https://github.com/o2team/tictactoe-sample">https://github.com/o2team/tictactoe-sample</a></li>
    </ul>

    <footer>备案号：</footer>
    </body>
    </html>
  `)
  res.end()
}

const app = process.env.NODE_ENV === 'production' ?
  require('https').createServer(config.httpsConfig, serveIndex):  // 生产环境服务器
  require('http').createServer(serveIndex)                      // 本地开发服务器
const io = require('socket.io')(app)
app.listen(config.port)

/**
 * 通过 socket id 获取 socket
 * @param id
 * @return {*}
 */
function getSocketById (id) {
  return io.of('/').connected[ id ]
}

/**
 * 通过 room id 获取房间内的所有 socket
 * @param roomId
 * @return {Promise<any>}
 */
function getSocketsInRoom (roomId) {
  return new Promise((resolve, reject) => {
    io.in(roomId).clients((err, clients) => {
      if (err) {
        reject(err)
        return
      }
      const sockets = clients.map(getSocketById)
      resolve(sockets)
    })
  })
}

async function createRoom(socket) {
  let player = await Players.getPlayer(socket.playerId)
  if (player.roomId) socket.leave(player.roomId)
  player = await Players.createRoom(socket.playerId)
  const join = promisify(socket.join).bind(socket)
  await join(player.roomId)
  return player
}

async function joinRoom(socket, roomId) {
  let player = await Players.getPlayer(socket.playerId)
  if (player.roomId) socket.leave(player.roomId)
  player = await Players.joinRoom(socket.playerId, roomId)
  const join = promisify(socket.join).bind(socket)
  await join(player.roomId)
  return player
}

// 有新玩家连接服务器
io.on('connection', function (socket) {
  socket
  // 小游戏端连接服务器后要首先发送 login 消息
    .on('login', async (payload, cb) => {
      console.log('------------  login')
      try {
        const player = await Players.login(payload)
        socket.playerId = player._id

        let resumeData = {}

        // 恢复房间
        if (player.roomId) {
          const join = promisify(socket.join).bind(socket)
          await join(player.roomId)
          const opponent = await Players.getOpponent(socket.playerId)
          const opponentInfo = opponent && await Players.getPlayerInfo(opponent)
          resumeData.room = {
            roomId: player.roomId,
            roomOwner: player.roomOwner,
            opponent: opponentInfo,
          }
        }

        // 恢复游戏
        if (player.playing) {
          const game = TicTacToe.getGame(player.roomId)
          resumeData.game = game && game.getInfoForPlayer(player._id)
        }

        cb && cb('', {
          session: player.session,          // 向小游戏端返回自定义登陆态
          resumeData,                   // 恢复用数据（若没有需要恢复的内容，则为 {} ）
        })
      }
      catch (err) {
        cb && cb(err)
      }
    })

    // 创建房间
    .on('create room', async cb => {
      console.log('------------  create room')
      const player = await createRoom(socket)
      cb && cb(player.roomId)
    })

    // 加入房间
    .on('join room', async (roomId, cb) => {
      console.log('------------  join room')
      try {
        await joinRoom(socket, roomId)
        const player = await Players.getPlayer(socket.playerId)
        const opponent = await Players.getOpponent(socket.playerId)
        const opponentInfo = opponent && await Players.getPlayerInfo(opponent)
        cb && cb('', { roomId: roomId, opponent: opponentInfo })
        // socket.emit('opponent joined', opponentInfo)
        socket.to(roomId).emit('opponent joined', await Players.getPlayerInfo(player))
      } catch (e) {
        cb && cb(e)
      }
    })

    // 游戏准备
    .on('ready', async (cb) => {
      console.log('------------  ready')
      let player = await Players.getPlayer(socket.playerId)

      if (!player.roomId) {
        cb && cb(ERRORS.JOIN_ROOM_FIRST)
        return
      }

      player = await Players.roomReady(socket.playerId)
      const opponent = await Players.getOpponent(socket.playerId)

      socket.to(player.roomId).emit('opponent ready')   // 发送"对手已准备"
      if (player.roomReady && opponent && opponent.roomReady) {
        const game = TicTacToe.createGame(player.roomId, [ player._id, opponent._id ])
        Players.gameStart(player._id)
        Players.gameStart(opponent._id)
        game.start()
      }
    })

    // 落子
    .on('place piece', async (row, col, cb) => {
      console.log('------------  place piece')
      let player = await Players.getPlayer(socket.playerId)
      const game = TicTacToe.getGame(player.roomId)
      if (game.getCurrentPlayer() === socket.playerId) {
        game.placePiece(row, col)
      } else {
        cb && cb(ERRORS.NOT_YOUR_TURN)
      }
    })

    // 离开房间
    .on('leave room', async (cb) => {
      console.log('------------  leave room')
      let player = await Players.getPlayer(socket.playerId)
      let opponent = await Players.getOpponent(socket.playerId)
      const sockets = await getSocketsInRoom(player.roomId)
      const socketPlayer = sockets.find(socket => socket.playerId === player._id)
      const socketOpponent = opponent && sockets.find(socket => socket.playerId === opponent._id)
      const roomId = player.roomId

      // 加入房间，且游戏未开始
      if (player.roomId && !player.playing) {
        if (player.roomOwner) {                                                  // 房主退出
          socketPlayer.leave(player.roomId)
          Players.leaveRoom(player._id)
          opponent && Players.leaveRoom(opponent._id)
          socketOpponent && socketOpponent.emit('room dismissed').leave(player.roomId)   // 发送"房间已解散"
        } else {                                                                 // 参与者退出
          socket.to(player.roomId).emit('opponent leaved').leave(player.roomId)  // 发送"对方已退出"
          Players.leaveRoom(player._id)
        }
        cb && cb()
        return
      }

      else {
        cb && cb(ERRORS.JOIN_ROOM_FIRST)
      }
    })
})

// 游戏开始事件
TicTacToe.onGameStart = async game => {
  console.warn('game start')
  const currentPlayer = await Players.getPlayer(game.getCurrentPlayer())
  const sockets = await getSocketsInRoom(currentPlayer.roomId)
  sockets.forEach(socket => {
    socket.emit('game start', game.getInfoForPlayer(socket.playerId))
  })
}

// 游戏进入下一轮事件
TicTacToe.onNextRound = async (game, lastAction) => {
  console.warn('next round')
  const currentPlayer = await Players.getPlayer(game.getCurrentPlayer())
  const sockets = await getSocketsInRoom(currentPlayer.roomId)
  const currentSocket = sockets.find(socket => socket.playerId === currentPlayer._id)
  const gameInfoForSelf = game.getInfoForPlayer(currentPlayer._id)
  gameInfoForSelf.lastAction = lastAction
  currentSocket.emit('your turn', gameInfoForSelf)
}

/**
 * 将 gameover 事件中的 winner 转换为特定玩家角度的游戏结果
 * @param winner
 * @param playerId
 * @return {string}
 */
function calcGameResult (winner, playerId) {
  if (!winner) return 'draw'
  else if (playerId === winner) return 'win'
  else return 'lose'
}

// 游戏结束事件
TicTacToe.onGameOver = async (game, winner, lastAction) => {
  const players = await Promise.all(game.players.map(async playerId => await Players.getPlayer(playerId)))

  // 发送胜负消息
  const sockets = await getSocketsInRoom(players[ 0 ].roomId)

  sockets.forEach(async socket => {
    const gameInfoForSelf = await game.getInfoForPlayer(socket.playerId)
    gameInfoForSelf.lastAction = lastAction
    gameInfoForSelf.result = calcGameResult(winner, socket.playerId)
    socket.emit('game over', gameInfoForSelf)
  })

  // 上报战绩
  game.players.forEach(async (playerId) => {
    player = await Players.gameEnd(playerId, calcGameResult(winner, playerId))
    weapi.sendScore(player)
  })

  // 离开房间
  Players.leaveRoom(players[0]._id)
  Players.leaveRoom(players[1]._id)
}
