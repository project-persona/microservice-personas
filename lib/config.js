module.exports = {
  // See https://docs.mongodb.com/manual/reference/connection-string/
  MONGO_CONNECTION_STRING: process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017',
  EMAIL_DOMAINS: process.env.EMAIL_DOMAINS ? process.env.EMAIL_DOMAINS.split(',').map(str => str.trim()) : ['mypersona.tk'],
  MONGO_DB: process.env.MONGO_DB || 'persona',
  PERSONA_COLLECTION: process.env.PERSONA_COLLECTION_NAME || 'personas',
  USED_EMAIL_COLLECTION: process.env.USED_EMAIL_COLLECTION_NAME || 'used-emails',
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || '/service-account-file.json'
}
