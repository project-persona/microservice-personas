const { RpcWorker, RpcProvider } = require('@persona/infra/service-broker')

const MongoClient = require('mongodb').MongoClient
const MongoObjectID = require('mongodb').ObjectId
// const admin = require('firebase-admin')

const { MONGO_CONNECTION_STRING, PERSONA_COLLECTION_NAME, USED_EMAIL_COLLECTION_NAME } = require('./config')

let db

class EmailDuplicationError extends Error {
  constructor (message) {
    super(message)
    this.name = 'EmailDuplicationError'
  }
}

// TODO: put helper functions somewhere else?
// maybe just assume all profile object inputs are valid?
function getInvalidKeys (profile) {
  const allowedKeys = ['alias', 'lastName', 'firstName', 'age', 'birthday', 'gender', 'email', 'address', 'phoneNumber']
  const allowedAddressKeys = ['line1', 'line2', 'city', 'state', 'country', 'zipCode']

  const inputKeys = Object.keys(profile)
  const invalidProfileKeys = inputKeys.filter(key => !allowedKeys.includes(key))

  const addressKeys = ('address' in profile && typeof profile.address === 'object' ? Object.keys(profile.address) : [])
  const invalidAddressKeys = addressKeys.filter(key => !allowedAddressKeys.includes(key)).map(key => 'address.' + key)

  return invalidProfileKeys.concat(invalidAddressKeys)
}

function getMissingRequiredKeys (profile) {
  // TODO: add required keys
  const requiredKeys = ['email', 'firstName', 'lastName']
  const profileKeys = Object.keys(profile)
  return requiredKeys.filter(key => !profileKeys.includes(key))
}

async function isEmailUsed (emailAddress, db) {
  const usedEmailCollection = db.collection(USED_EMAIL_COLLECTION_NAME)
  const findCursor = usedEmailCollection.find({ email: emailAddress })
  const result = await findCursor.toArray()
  return result.length !== 0
}

// todo return success/fail?
async function markEmailUsed (emailAddress, db) {
  const usedEmailCollection = db.collection(USED_EMAIL_COLLECTION_NAME)
  return await usedEmailCollection.insertOne({ email: emailAddress })
}

module.exports = new RpcWorker('personas', class extends RpcProvider {
  async [RpcProvider.init] () {
    const client = new MongoClient(MONGO_CONNECTION_STRING)
    await client.connect()
    db = client.db('personas') // again, collection names are preferred to be in plural form
  }

  // a request-scoped before hook: this hook runs for every request before your actually method
  async [RpcProvider.before] () {
    // if (this.context.type === 'system') {
    //   return
    // }
    //
    // if (!this.context.authorization) {
    //   console.log('User not logged in')
    // }
    //
    // await admin.auth().verifyIdToken(this.context.authorization)
  }

  async validate (profile) {
    try {
      return getInvalidKeys(profile)
    } catch (err) {
      console.log(err)
    }
  }

  async create (profile) {
    const missingKeys = getMissingRequiredKeys(profile)
    if (missingKeys.length !== 0) {
      console.log('missing key required: ', missingKeys)
      throw new Error('personas/create() missing required keys in profile parameter: ' + missingKeys)
    }

    const invalidKeys = getInvalidKeys(profile)
    if (invalidKeys.length !== 0) {
      console.log('invalid keys detected: ', invalidKeys)
      throw new Error('personas/create() profile parameter contain invalid keys: ' + missingKeys)
    }

    const emailUsed = await isEmailUsed(profile.email, db)
    console.log('email used: ', emailUsed)
    if (emailUsed) {
      console.log('email is already used: ', profile.email)
      // TODO: make sure this error can be caught
      throw new EmailDuplicationError('persona/create() attempting to register profile with previously used email')
    }

    try {
      await markEmailUsed(profile.email, db)
      const personas = db.collection(PERSONA_COLLECTION_NAME)
      // insertOne automatically adds _id to the object. type is new ObjectId('id')
      await personas.insertOne(profile)
    } catch (err) {
      console.err(err)
    }
    return profile
  }

  async list (count) {
    // todo: return list of object within count. This implies the collection has order
    try {
      const personas = db.collection(PERSONA_COLLECTION_NAME)
      const searchCursor = await personas.find()
      return await searchCursor.toArray()
    } catch (err) {
      console.log('Error during list: ', err)
    }
  }

  async show (id) {
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
    delete persona.email
    delete persona._id
    const mongoObjectID = new MongoObjectID(id)
    try {
      const collection = db.collection(PERSONA_COLLECTION_NAME)
      return await collection.updateOne({ _id: mongoObjectID }, { $set: persona })
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

  // a request-scoped after hook: this hook runs for every request after your actually method
  async [RpcProvider.after] () {
    // the after hook is perfect your cleaning things up, if needed
  }
})
