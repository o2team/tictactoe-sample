const promisify = require('util').promisify
const Database = require('nedb')

const players = new Database({ filename: './players.db', autoload: true })

function promisifyDb (db) {
  db.update[ promisify.custom ] = (query, update, options) => {
    return new Promise((resolve, reject) => {
      db.update(query, update, options, (err, numAffected, affectedDocuments, upsert) => {
        if (err) reject(err)
        else resolve({
          numAffected,
          affectedDocuments,
          upsert,
        })
      })
    })
  }
  return {
    insert: promisify(db.insert).bind(db),
    find: promisify(db.find).bind(db),
    findOne: promisify(db.findOne).bind(db),
    count: promisify(db.count).bind(db),
    remove: promisify(db.remove).bind(db),
    ensureIndex: promisify(db.ensureIndex).bind(db),
    update: promisify(db.update),
  }
}

module.exports = {
  players: promisifyDb(players),
}