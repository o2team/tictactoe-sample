require('./js/libs/weapp-adapter')
window.CONFIG = require('./config')
window.p2 = require('./js/libs/p2')
window.PIXI = require('./js/libs/pixi')
window.Phaser = require('./js/libs/phaser-split')

// 定义全局常量
window.WIDTH = 750                     // 游戏宽度
window.SCALE = WIDTH / canvas.width    // 游戏宽度/ canvas 宽度
window.HEIGHT = canvas.height * SCALE  // 游戏高度

// 设置被动转发信息
wx.onShareAppMessage(() => {
  return {
    title: '井字大作战',
    imageUrl: 'images/share.png',
  }
})
// 显示右上角菜单中的转发选项
wx.showShareMenu({
  withShareTicket: false
})

// 设置离屏 canvas 尺寸
let openDataContext = wx.getOpenDataContext()
let sharedCanvas = openDataContext.canvas
sharedCanvas.width = WIDTH
sharedCanvas.height = HEIGHT

// go: Global Object 用于在 state 之间共享数据和方法
window.go = {
  game: null,                       // 游戏实例
  userInfo: null,                   // 玩家信息
  opponentInfo: null,               // 对手信息
  common: require('js/common'),     // 公共函数
  server: require('js/server.js'),  // 与服务器的交互
  launchRoomId: null,               // 进入主菜单时需要加入的房间 id
  battle: null,                     // 对战状态
}

// 初始化游戏
const config = {
  width: WIDTH,
  height: HEIGHT,
  renderer: Phaser.CANVAS,
  canvas: canvas
}
localStorage.debug = '*';

const game = new Phaser.Game(config)
// 全局对象中保存一个 game 的引用
go.game = game
// 注册游戏场景
game.state.add('start', require('./js/states/start'))
game.state.add('menu', require('./js/states/menu'))
game.state.add('practice', require('./js/states/practice'))
game.state.add('waiting', require('./js/states/waiting'))
game.state.add('battle', require('./js/states/battle'))
game.state.add('rank', require('./js/states/rank'))
// 进入 start 场景
game.state.start('start')
