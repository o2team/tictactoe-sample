const config = require('./config')
const crypto = require('crypto')
const request = require('request-promise-native')

const hmac_sha256 = (sessionKey, data) => {
  return crypto
    .createHmac('sha256', sessionKey)
    .update(data || '')
    .digest('hex')
}

let tokenRefreshTimeout
let token

/**
 * 调用以主动刷新 access token
 * @return {Promise<void>}
 */
async function accessToken () {
  try {
    clearTimeout(tokenRefreshTimeout)
    const res = await request({
      uri: `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.appid}&secret=${config.secret}`,
      json: true,
    })
    if (res.errcode) throw res
    token = res.access_token

    console.log('access token 获取成功：', token)

    // 提前 200 秒定时刷新 access_token
    // 200 秒并没有特殊意义，可以酌情修改
    tokenRefreshTimeout = setTimeout(accessToken, (res.expires_in - 200) * 1000)
  } catch (e) {
    console.error('access token 获取失败：', e)
    tokenRefreshTimeout = setTimeout(accessToken, 60 * 1000)   // 1分钟后重试
  }
}

accessToken()    // 初始化时请求一次，其他位置也可以主动调用以立即刷新 token

/**
 * wx.login 登陆流程，使用 code 换取 session_key 与 openid
 * @param code
 * @return {Promise<void>}
 */
async function code2session (code) {
  const session = await request({
    uri: `https://api.weixin.qq.com/sns/jscode2session?appid=${config.appid}&secret=${config.secret}&js_code=${code}&grant_type=authorization_code`,
    json: true,
  })
  return session
}

const object2KVDataList = (o) => {
  let result = []
  Object.keys(o).forEach( key => {
    result.push({
      key: key,
      value: JSON.stringify(o[key])
    })
  })
  return {
    kv_list: result
  }
}

/**
 * 上报用户数据
 * @param player
 * @param kv
 * @return {Promise<void>}
 */
async function setUserStorage (player, kv) {
  const kvList = object2KVDataList(kv)
  const postData = JSON.stringify(kvList)
  const res = await request({
    uri: `https://api.weixin.qq.com/wxa/set_user_storage?access_token=${token}&signature=${hmac_sha256(player.sessionKey, postData)}&openid=${player.openId}&sig_method=hmac_sha256`,
    method: 'POST',
    body: kvList,
    json: true,
  })
  return res
}

/**
 * 上报指定玩家的战绩
 * @param player
 * @return {Promise<void>}
 */
async function sendScore (player) {
  const score = await setUserStorage(player, {
    score: {
      wxgame: {
        score: player.scoreTotal,
        update_time: Math.floor(Date.now() / 1000)
      },
      win: player.scoreWin,
      total: player.scoreTotal
    }
  })
}

module.exports = {
  code2session,
  sendScore,
}
