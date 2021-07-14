const { RpcWorker, RpcProvider } = require('@persona/infra/service-broker')

// const MongoClient = require('mongodb').MongoClient
// const admin = require('firebase-admin')

// const { MONGO_CONNECTION_STRING } = require('./config')

// let db

// new RpcWorker (service, provider, address)
// - service: string, human readable service set name, preferably in plural form
// - RpcProvider: a class extends from RpcProvider
// - address: optional, ZeroMQ connection address, fallback to `BROKER_ADDR` env var when not provided
module.exports = new RpcWorker('arithmetics', class extends RpcProvider {
  // a new instance of RpcProvider is created for each request, so anything mounted to `this` is only available for that
  // request only

  // a service-wide initializer: this hook will only run once for a service
  async [RpcProvider.init] () {
    // the init hook is perfect for initializing external services like databases:
    // const client = new MongoClient()
    // await client.connect()
    // db = client.db('your-collection-name-here') // again, collection names are preferred to be in plural form
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

  // your actual method: name this function whatever your like as long as it's human readable
  async add (a, b) {
    // Note: the function is async, so you can perform other async operations, for example:
    // - accessing a database
    // - calling other microservices

    // To call other microservices
    // await this.services.yourService.yourMethod() // from user context, ie., context.type === 'user'
    // await this.systemServices.yourService.yourMethod() // from system context, ie., context.type === 'system'

    // any error thrown is automatically propagated to caller, all the way to web client (unless someone catches it)

    return a + b
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
