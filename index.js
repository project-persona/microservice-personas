require('./lib').start().catch(err => {
  // uncaught errors are fatal
  console.error(err)
  process.exit(1)
})
