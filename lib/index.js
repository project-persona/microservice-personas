const { RpcWorker, RpcProvider } = require('@persona/infra/service-broker')

const MongoClient = require('mongodb').MongoClient
const MongoObjectID = require('mongodb').ObjectId
// const admin = require('firebase-admin')

const { MONGO_CONNECTION_STRING, PERSONA_COLLECTION_NAME } = require('./config')

let db

module.exports = new RpcWorker('personas', class extends RpcProvider {
  async [RpcProvider.init] () {
    console.log('creating connection')
    const client = new MongoClient(MONGO_CONNECTION_STRING)
    await client.connect()
    db = client.db('personas') // again, collection names are preferred to be in plural form
  }

  async [RpcProvider.before] () {
  }

  async create (profile) {
    // todo: authenticate user
    // todo: validate(profile)
    try {
      const personas = db.collection(PERSONA_COLLECTION_NAME)
      await personas.insertOne(profile)
    } catch (err) {
      console.log('Error during create: ', err)
    }
    // insertOne automatically adds _id to the object. type is new ObjectId("id")
    return profile
  }

  async list (count) {
    // todo: authenticate user
    // todo: return list of object within count. This implies the collection has order
    try {
      const personas = db.collection(PERSONA_COLLECTION_NAME)
      const searchCursor = await personas.find()
      const result = await searchCursor.toArray()
      return result
    } catch (err) {
      console.log('Error during list: ', err)
    }
  }

  async show (id) {
    // TODO: authenticate user
    // TODO: handle type error
    try {
      const mongoObjectID = new MongoObjectID(id)
      const personas = db.collection(PERSONA_COLLECTION_NAME)
      const searchCursor = await personas.find({ _id: mongoObjectID })

      const personaFound = await searchCursor.toArray()
      console.log('persona found:', personaFound)
      return personaFound
    } catch (err) {
      console.log(err)
      return -1
    }
  }

  async edit (id, persona) {
    // TODO: validate persona, ignore id or email
    // TODO: authentication
    const mongoObjectID = new MongoObjectID(id)
    try {
      const collection = db.collection(PERSONA_COLLECTION_NAME)
      const updateResult = await collection.updateOne({ _id: mongoObjectID }, { $set: persona })
      return updateResult
    } catch (err) {
      console.log(err)
      return -1
    }
  }

  async delete (id) {
    const mongoObjectID = new MongoObjectID(id)
    try {
      const collection = db.collection(PERSONA_COLLECTION_NAME)
      await collection.deleteOne({ _id: mongoObjectID })
    } catch (err) {
      console.log(err)
    }
  }

  // there can be multiple methods
  async min (a, b) {
    return b - a
  }

  // a request-scoped after hook: this hook runs for every request after your actually method
  async [RpcProvider.after] () {
    // the after hook is perfect your cleaning things up, if needed
  }
})
