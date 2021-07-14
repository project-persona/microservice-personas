# @persona/microservice-template

a template repository which other microservices *SHOULD* fork from

"SHOULD" means you don't have to use this, as long as your microservice implementation is compliant with all others.

## Requirements:
- `cmake`

## Usage

### Fork this repository

Click the "fork" button in the top-right corner of the [repository page](https://github.com/project-persona/microservice-template).
Remember to fork to "project-persona" organization. 

### Rename the forked repository

The new repository name should be one of
- `microservice-users`
- `microservice-personas`
- `microservice-passwords`
- `microservice-notes`
- `microservice-emails`

### Update the template to match your microservice

Clone the newly forked repository:

```
$ git clone git@github.com:project-persona/microservice-<your-service>.git
$ cd microservice-<your-service>
```

Update the `package.json` file. You need to at least update the following field:

- `name`
- `description`
- `repository.url`

Install dependencies and git-hook:

```
$ npm install
```

This step will install a git hook that runs `npm run test` before each commit. **Your git client will refuse to commit 
if the test script fails!**  

You can optionally add more tests if  you'd like. The template uses [JavaScript Standard Style](https://standardjs.com/) 
for linting by default.

Commit your changes:

```
$ git add *
$ git commit -m "update template for development"
```

### Start coding!

You're encouraged to browse through existing code for usage on RPC Worker.