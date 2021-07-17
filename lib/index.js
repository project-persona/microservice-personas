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
      console.log(err)
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
    // ignore email and id from edit
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

  async template () {
    // Note: the function is async, so you can perform other async operations, for example:
    // - accessing a database
    // - calling other microservices

    // To call other microservices
    // await this.services.yourService.yourMethod() // from user context, ie., context.type === 'user'
    // await this.systemServices.yourService.yourMethod() // from system context, ie., context.type === 'system'

    // any error thrown is automatically propagated to caller, all the way to web client (unless someone catches it)
  }

  // PASSWORD CALLS
  // todo: not really a point having this cluttered in persona function. just need to pass in personaId
  // maybe auth-api service?
  async passwordCreate (personaId, passwordObject) {
    try {
      await this.systemServices.passwords.create(personaId, passwordObject)
    } catch (err) {
      console.log(err)
    }
  }

  async passwordList (personaId, count) {
    try {
      return await this.systemServices.passwords.list(personaId, 10)
    } catch (err) {
      console.log(err)
    }
  }

  async passwordShow (personaId, passwordId) {
    try {
      return await this.systemServices.passwords.show(personaId, passwordId)
    } catch (err) {
      console.log(err)
    }
  }

  async passwordEdit (personaId, passwordId, password) {
    try {
      return await this.systemServices.passwords.edit(personaId, passwordId, password)
    } catch (err) {
      console.log(err)
    }
  }

  async passwordDelete (personaId, passwordId) {
    try {
      return await this.systemServices.passwords.delete(personaId, passwordId)
    } catch (err) {
      console.log(err)
    }
  }

  // NOTE CALLS

  async noteCreate (personaId, noteObject) {
    try {
      return await this.systemServices.notes.create(personaId, noteObject)
    } catch (err) {
      console.log(err)
    }
  }

  async noteList (personaId) {
    try {
      return await this.systemServices.notes.list(personaId, 10)
    } catch (err) {
      console.log(err)
    }
  }

  async noteShow (personaId, noteId) {
    try {
      return await this.systemServices.notes.show(personaId, noteId)
    } catch (err) {
      console.log(err)
    }
  }

  async noteEdit (personaId, noteId, noteObject) {
    try {
      return await this.systemServices.notes.edit(personaId, noteId, noteObject)
    } catch (err) {
      console.log(err)
    }
  }

  async noteDelete (personaId, noteId) {
    try {
      return await this.systemServices.notes.delete(personaId, noteId)
    } catch (err) {
      console.log(err)
    }
  }

  // a request-scoped after hook: this hook runs for every request after your actually method
  async [RpcProvider.after] () {
    // the after hook is perfect your cleaning things up, if needed
  }
})
