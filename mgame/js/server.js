/**
 * 服务器相关
 */

// 引入 Socket.IO SDK
const SocketIO = require('./libs/socket.io.slim.js')

/**
 * 创建房间
 */
function createRoom(cb) {
  go.server.socket.emit('create room', cb)
}

/**
 * 加入房间
 */
function joinRoom(roomId, cb) {
  go.server.socket.emit('join room', roomId, cb)
}

/**
 * 离开房间
 */
function leaveRoom(cb) {
  go.server.socket.emit('leave room', cb)
}

/**
 * 准备游戏
 */
function ready(cb) {
  go.server.socket.emit('ready', cb)
}

/**
 * 落子
 */
function placePiece(col, row) {
  go.server.socket.emit('place piece', col, row)
}

/**
 * 使用 session 登录，自动用 code 作为后备
 */
function loginWithSession(callback) {
  // 取出登录态
  const session = wx.getStorageSync('session')
  if (!session) {
    // 没有登录态则使用 wx.login 流程登录
    loginWithCode(callback)
    return
  }

  // 准备 login 消息所需信息
  const payload = {
    playerInfo: go.userInfo,  // 用户基本信息
    session,                  // 登录态
  }
  go.server.socket.emit('login', payload, (err, res) => {
    if (err) {
      // 若通过登录态登录失败，尝试通过 wx.login 流程登录
      loginWithCode(callback)
      return
    }
    // 调用登录成功回调
    callback(res)
  })
}

/**
 * 使用 code 登录
 */
function loginWithCode(callback) {
  // 调用 wx.login 获取 code
  wx.login({
    success: (res) => {
      // 准备 login 消息所需信息
      const payload = {
        playerInfo: go.userInfo,  // 玩家基本信息
        code: res.code,           // 服务器向微信获取登录态所需的 code
      }
      go.server.socket.emit('login', payload, (err, res) => {
        // 登录失败
        if (err) {
          wx.showToast({
            title: '登录失败',
          })
          return
        }
        // 保存服务器返回的登录态
        wx.setStorageSync('session', res.session)
        // 调用登录成功回调
        callback(res)
      })
    }
  })
}

/**
 * 初始化 socketio
 */
function initSocket() {
  // 连接 Socket.IO 服务器，
  go.server.socket = SocketIO(CONFIG.server, {
    transports: ['websocket'],
  })

  // 进入后台，断开连接
  wx.offShow(() => {
    go.server.socket.disconnect()
  })
  // 回到前台，连接服务器
  wx.onShow(() => {
    go.server.socket.connect()
  })

  // 连接/重连事件
  go.server.socket.on('connect', () => {
    // 连接服务器成功，准备 login 消息的回调
    const callback = (res) => {
      // login 成功后，服务器会返回用于恢复游戏的数据
      // 我们触发一个 'game resume' 事件并附上恢复数据以便其他地方使用
      emitter.emit('game resume', res.resumeData)
    }
    // 根据微信登录态的有效性决定登陆方式
    wx.checkSession({
      success: () => {
        // 登录态有效，使用登录态
        loginWithSession(callback)
      },
      fail: () => {
        // 登录态过期，重新走 wx.login 流程
        loginWithCode(callback)
      }
    })
  })

  const events = [
    // Socket.IO 内部消息方便定位问题
    'connect', 'disconnect', 'error', 'connect_timeout', 'connect_error',
    'reconnect_attempt', 'reconnecting', 'reconnect_error', 'reconnect_failed',

    // 业务事件
    'opponent joined', 'game start', 'your turn', 'game over'
  ]
  events.forEach(ev => {
    go.server.socket.on(ev, playerInfo => {
      console.log(`>>>>>> 收到 ${ev} 消息：`, playerInfo)
      emitter.emit(ev, playerInfo)
    })
  })
}

/**
 * 一个简单的 Emitter 实现，接口：on、once、emit
 */
function makeEmitter() {
  const events = []
  return {
    on: (event, fn) => events.push({ event, fn }),
    once: (event, fn) => events.push({ event, fn, once: true }),
    off: (event, fn) => events.splice(events.find(
      ev => event === ev.event && ev.fn === fn
    ) - 1, 1),
    emit: (event, ...args) => events.filter(ev => event === ev.event).forEach(ev => {
      ev.fn.apply(null, args)
      ev.once && events.splice(events.indexOf(ev), 1)
    }),
    events
  }
}
const emitter = makeEmitter()

module.exports = {
  socket: null,
  createRoom,
  joinRoom,
  leaveRoom,
  ready,
  placePiece,
  initSocket,

  on: emitter.on,
  once: emitter.once,
  off: emitter.off,
}
