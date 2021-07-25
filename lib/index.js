const { RpcWorker, RpcProvider } = require('@persona/infra/service-broker')

const { MongoClient, ObjectId } = require('mongodb')
const admin = require('firebase-admin')
const Parameter = require('parameter')
const dot = require('mongo-dot-notation')

const {
  MONGO_CONNECTION_STRING,
  EMAIL_DOMAINS,
  MONGO_DB,
  PERSONA_COLLECTION,
  USED_EMAIL_COLLECTION,
  GOOGLE_APPLICATION_CREDENTIALS
} = require('./config')

const RULES = {
  alias: {
    type: 'string',
    required: false
  },
  lastName: {
    type: 'string',
    required: false
  },
  firstName: {
    type: 'string',
    require: false
  },
  age: {
    type: 'int',
    min: 0,
    required: false
  },
  birthday: {
    type: 'date',
    required: false
  },
  gender: {
    type: 'string',
    required: false
  },
  email: {
    type: 'email', // verify domain later
    required: true
  },
  address: {
    type: 'object',
    required: false,
    rule: {
      line1: {
        type: 'string'
      },
      line2: {
        type: 'string',
        required: false,
        allowEmpty: true
      },
      city: 'string',
      state: 'string',
      country: 'string',
      zipCode: 'string'
    }
  },
  phone: {
    type: 'string',
    required: false,
    format: /^(\(?\+?[0-9]*\)?)?[0-9_\- ()]+$/ // there is probably a better regex
  }
}

function validate (document) {
  const rules = {}
  const data = {}
  for (const key of Object.keys(document)) {
    rules[key] = RULES[key]
    data[key] = document[key]
  }

  const validator = new Parameter()
  const errors = validator.validate(rules, data)
  if (errors) {
    throw new Error(errors[0].field + ' ' + errors[0].message)
  }
}

let personas, usedEmails

function assertEmailDomain (email) {
  if (!EMAIL_DOMAINS.find(domain => email.toLowerCase().endsWith('@' + domain.toLowerCase()))) {
    throw new Error('Invalid email domain. Must be one of: ' + EMAIL_DOMAINS.join(', '))
  }
}

async function assertEmailNotUsedByAnotherUser (email, uid) {
  const entry = await usedEmails.findOne({
    email,
    uid: { $not: { $eq: uid } }
  })

  if (entry) {
    throw new Error('Email already used by another user')
  }
}

async function markEmailUsed (email, uid) {
  await usedEmails.insertOne({ email, uid })
}

module.exports = new RpcWorker('personas', class extends RpcProvider {
  async [RpcProvider.init] () {
    const client = new MongoClient(MONGO_CONNECTION_STRING)
    await client.connect()
    personas = client.db(MONGO_DB).collection(PERSONA_COLLECTION)
    usedEmails = client.db(MONGO_DB).collection(USED_EMAIL_COLLECTION)

    admin.initializeApp({
      credential: admin.credential.cert(require(GOOGLE_APPLICATION_CREDENTIALS))
    })
  }

  async [RpcProvider.before] () {
    if (this.context.type === 'system') {
      return
    }

    if (!this.context.authorization) {
      console.log('User not logged in')
    }

    this.user = await admin.auth().verifyIdToken(this.context.authorization.substring('Bearer '.length))
  }

  /***
   * creates a new persona for a logged in user
   *
   * @param persona a new persona object ('_id' and 'uid' is ignored)
   * @return {Promise<?>} newly created persona object with '_id' and 'uid'
   */
  async create (persona) {
    persona = persona || {}

    const { alias, lastName, firstName, age, birthday, gender, email, address, phone } = persona
    const payload = {
      alias,
      lastName,
      firstName,
      age,
      birthday,
      gender,
      email,
      address,
      phone
    }

    validate(payload)
    assertEmailDomain(email)
    await assertEmailNotUsedByAnotherUser(email, this.user.uid)

    payload.address = address || {}
    payload.uid = this.user.uid

    const { insertedId } = await personas.insertOne(payload)
    await markEmailUsed(email, this.user.uid)

    return {
      _id: insertedId,
      ...payload
    }
  }

  /**
   * lists all available personas for current logged in user
   *
   * @return {Promise<[?]>} all persona belonged to current user
   */
  async list () {
    return await personas.find({ uid: this.user.uid }).toArray()
  }

  /***
   * returns the persona with requested id if current logged in user has access to it
   *
   * @param id persona id
   * @return {Promise<?>} requested persona object
   */
  async show (id) {
    const persona = await personas.findOne({
      _id: ObjectId(id),
      uid: this.user.uid
    })

    if (!persona) {
      throw new Error('Requested persona doesn\'t exists or currently logged in user has no permission to access it')
    }

    return persona
  }

  async showByEmail (email) {
    if (this.context.type !== 'system') {
      throw new Error('emails/showByEmail() must be called from a system context')
    }

    const persona = await personas.findOne({ email })
    if (!persona) {
      throw new Error('Requested persona doesn\'t exists')
    }

    return persona
  }

  /***
   * edits the requested persona with a full or partial persona object
   *
   * @param id persona id
   * @param persona partial or full persona object (email, id, and uid are ignored)
   * @return {Promise<?>} modified persona object
   */
  async edit (id, persona) {
    persona = persona || {}

    const acceptableKeys = ['alias', 'lastName', 'firstName', 'age', 'birthday', 'gender', 'address', 'phone']
    const payload = Object.keys(persona)
      .filter(key => acceptableKeys.includes(key))
      .reduce((obj, key) => {
        obj[key] = persona[key]
        return obj
      }, {})

    validate(payload)
    // uncomment following lines to allow updating email
    // if (payload.email) {
    //   assertEmailDomain(payload.email)
    //   await assertEmailNotUsedByAnotherUser(payload.email, this.user.uid)
    // }

    const { matchedCount } = await personas.updateOne({
      _id: ObjectId(id),
      uid: this.user.uid
    }, dot.flatten(payload))

    if (matchedCount === 0) {
      throw new Error('Requested persona doesn\'t exists or currently logged in user has no permission to access it')
    }

    return await this.show(id)
  }

  /**
   * deletes the requested persona
   *
   * Note: this does NOT release the email address for other users to use
   *
   * @param id persona id
   * @return {Promise<null>} literally 'null'
   */
  async delete (id) {
    const { deletedCount } = await personas.deleteOne({
      _id: ObjectId(id),
      uid: this.user.uid
    })

    if (deletedCount === 0) {
      throw new Error('Requested persona doesn\'t exists or currently logged in user has no permission to access it')
    }

    return null
  }
})
