const { RpcWorker, RpcProvider } = require('@persona/infra/service-broker')

const MongoClient = require('mongodb').MongoClient
// const admin = require('firebase-admin')

const { MONGO_CONNECTION_STRING, PERSONA_COLLECTION_NAME } = require('./config')

let db

// new RpcWorker (service, provider, address)
// - service: string, human readable service set name, preferably in plural form
// - RpcProvider: a class extends from RpcProvider
// - address: optional, ZeroMQ connection address, fallback to `BROKER_ADDR` env var when not provided
module.exports = new RpcWorker('personas', class extends RpcProvider {
  // a new instance of RpcProvider is created for each request, so anything mounted to `this` is only available for that
  // request only

  // a service-wide initializer: this hook will only run once for a service
  async [RpcProvider.init] () {
    // the init hook is perfect for initializing external services like databases:
    console.log('creating connection')
    const client = new MongoClient(MONGO_CONNECTION_STRING)
    await client.connect()
    db = client.db('personas') // again, collection names are preferred to be in plural form
  }

  // a request-scoped before hook: this hook runs for every request before your actually method
  async [RpcProvider.before] () {
    // the before hook is perfect for authenticate user identity:
    // if (this.context.authorization) {
    //   const user = await admin.auth().verifyIdToken(this.context.authorization)
    //   console.log(`Requesting uid: ` + user.uid)
    // } else {
    //   console.log('User not logged in')
    // }

    // some times you wanna allow other microservices to do whatever they want, regardless of which use issues the
    // original request
    // if (this.context.type === 'system') {
    //   console.log('The request is from other microservice')
    // } else { //  this.context.type === 'user'
    //   console.log('The request is from a user')
    // }
  }

  async notes (profile) {
    // console.log("helloworld")
    // console.log(db.scores.count())
    // // try catch?
    // db.scores.save({a: 90});
    // console.log(db.scores.count())
    console.log('db content:')
    const collections = await db.collections()
    collections.forEach(c => console.log(c.collectionName))

    const personas = db.collection(PERSONA_COLLECTION_NAME)
    // const searchCursor = await personas.find()
    //
    // while(await searchCursor.hasNext()) {
    //   console.log(await(searchCursor.next()))
    // }
    //
    // const result = await searchCursor.toArray();
    // console.table(result)

    const insertCursor = await personas.insert(
      {
        name: 'dodo',
        age: 123,
        address: 'helloworld'
      }
    )
    console.log(insertCursor.insertedCount)

    const searchCursor = await personas.find()
    const result = await searchCursor.toArray()
    console.table(result)
    return 0
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
      console.table(result)
      return result
    } catch (err) {
      console.log('Error during list: ', err)
    }
  }

  async show (id) {
    // TODO: fix find by id does not work. fix obj type
    console.log('sanity check show')
    const personas = db.collection(PERSONA_COLLECTION_NAME)
    const searchCursor = await personas.find({ _id: id })
    const resultCount = await searchCursor.count()

    console.log('result count: ', resultCount)
    const personaFound = await searchCursor.toArray()
    console.log('persona found:', personaFound)
  }

  async edit (id, updatedProfile) {
    // TODO
    return 0
  }

  async delete (id) {
    // TODO
    return 0
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
