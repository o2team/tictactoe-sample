const weapi = require('./weapi')
const shortid = require('shortid')
const db = require('./db').players
const config = require('./config')
const ERRORS = require('./errors')

/**
 * 用小游戏发来的 code 换取 openId ，并生成自定义 session
 * @param payload
 * @return {Promise<uid|*|string|Index>}
 */
async function login (payload) {
  let player
  if (payload.code) {
    const session = await weapi.code2session(payload.code)

    player =  await db.findOne({ openId: session.openid })
    if (player) {
      const updatedDoc = await updateWithPlayerId(player._id, {
        $set: {
          session: shortid.generate(),
          playerInfo: payload.playerInfo,
          sessionKey: session.session_key,
        },
      })
      player = updatedDoc
    } else {
      player = await db.insert({
        openId: session.openid,
        sessionKey: session.session_key,
        session: shortid.generate(),
        playerInfo: payload.playerInfo,
        scoreWin: 0,
        scoreTotal: 0,
      })
    }
  } else if (payload.session) {
    player = await db.findOne({ session: payload.session })
    player = await updateWithPlayerId(player._id, {
      $set: {
        playerInfo: payload.playerInfo,
      },
    })
  }

  if (!player) throw ERRORS.CODE_OR_SESSION_INVALID
  return player
}

/**
 * 通过 id 获取玩家
 * @param playerId
 * @return {Promise<void>}
 */
async function getPlayer (playerId) {
  return await db.findOne({
    _id: playerId,
  })
}

/**
 * 获取对手玩家
 * @param player
 * @return {Promise<void>}
 */
async function getOpponent (playerId) {
  const player = await getPlayer(playerId)
  return await db.findOne({
    roomId: player.roomId,
    _id: {
      $ne: player._id,
    },
  })
}

/**
 * 获取房间中所有的玩家
 * @param roomId
 * @return {Promise<*>}
 */
async function getPlayersInRoom (roomId) {
  return await db.find({
    roomId: roomId,
  })
}

/**
 * 获取适合发送给小游戏端的玩家信息
 * @param player
 * @return {Promise<{avatarUrl: *, gender: *, nickName: *}>}
 */
async function getPlayerInfo (player) {
  return {
    avatarUrl: player.playerInfo.avatarUrl,  // 头像地址
    gender: player.playerInfo.gender,        // 性别
    nickName: player.playerInfo.nickName,    // 昵称
    ready: player.roomReady,                 // 是否已准备
  }
}

/**
 * 创建房间
 * @param playerId
 * @return {Promise<*>}
 */
async function createRoom (playerId) {
  const roomId = shortid.generate()

  return await updateWithPlayerId(playerId, {
    $set: {
      roomId: roomId,
      // roomId: '123456',   // TODO: 测试用
      roomOwner: true,
      roomReady: false,
    },
  })
}

/**
 * 加入房间
 * @param playerId
 * @param roomId
 * @return {Promise<*>}
 */
async function joinRoom (playerId, roomId) {
  const roomPlayers = await getPlayersInRoom(roomId)

  if (roomPlayers.find(roomPlayer => roomPlayer._id === playerId)) {
    throw ERRORS.ALREADY_IN_ROOM
  }

  if (roomPlayers.length >= 2) {
    throw ERRORS.ROOM_IS_FULL
  }

  if (roomPlayers.length === 0) {
    throw ERRORS.ROOM_NOT_EXIST
  }

  return await updateWithPlayerId(playerId, {
    $set: {
      roomId: roomId,
      roomOwner: false,
    },
  })
}

/**
 * 离开房间
 * @param playerId
 * @return {Promise<*>}
 */
async function leaveRoom (playerId) {
  return await updateWithPlayerId(playerId, {
    $unset: {
      roomId: true,
      roomReady: true,
      roomOwner: true,
      playing: true,
      gameId: true,
    },
  })
}

/**
 * 准备
 * @param playerId
 * @return {Promise<*>}
 */
async function roomReady (playerId) {
  return await updateWithPlayerId(playerId, { $set: { roomReady: true } })
}

/**
 * 开始游戏
 * @param playerId
 * @return {Promise<*>}
 */
async function gameStart (playerId) {
  return await updateWithPlayerId(playerId, {
    $set: { playing: true },
    $unset: { roomReady: true },
  })
}

/**
 * 游戏结束，更新分数
 * @param playerId
 * @param result
 * @return {Promise<*>}
 */
async function gameEnd (playerId, result) {
  if (result === 'even') return getPlayer(playerId)       // 平局不记成绩
  const isWin = result === 'win'

  return await updateWithPlayerId(playerId, {
    $unset: { playing: false },
    $inc: {
      scoreTotal: 1,
      scoreWin: isWin ? 1 : 0,
    },
  })
}

/**
 * 更新玩家信息工具函数
 * @param id
 * @param update
 * @return {Promise<void>}
 */
async function updateWithPlayerId (id, update) {
  const originPlayer = await getPlayer(id)
  const updated = await db.update({ _id: id }, update, { returnUpdatedDocs: true })
  return updated.affectedDocuments || originPlayer
}

module.exports = {
  login,
  getOpponent,
  getPlayer,
  getPlayerInfo,
  createRoom,
  joinRoom,
  leaveRoom,
  roomReady,
  gameStart,
  gameEnd,
}