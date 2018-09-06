const fs = require('fs')

// 小游戏配置项
const config = {
  appid: 'REPLACE_WITH_YOUR_APPID',
  secret: 'REPLACE_WITH_YOUR_SECRET',

  httpsConfig: {
    key: fs.readFileSync('./keykeykey.key'),
    cert: fs.readFileSync('./crtcrtcrt.crt'),
  },

  // 可以用环境变量指定端口，默认 443
  port: process.env.PORT || 443,
}

module.exports = config