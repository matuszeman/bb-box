module.exports = {
  name: 'node',
  runtime: 'Local',
  configure: {
    once: {
      '01-createConfig': (runner) => {
        //console.log(runner); // XXX
      }
    }
  },
  build: {
    run: 'npm i'
  },
  docker: {
    file: 'Dockerfile'
  },
  services: {
    'js-app': {
      start: 'node js-app.js [bbox.val]',
      // valueProviders: {
      //   version: 'node get-version.js'
      // }
    },
    'ts-app': {
      start: 'npx ts-node ts-app.ts'
    }
  },
  // migrations: {
  //   '01-createConfig': (params) => {
  //     console.log(params); // XXX
  //   },
  //   // This executes second. Migrations are ordered by key before they run.
  //   '2020-07-16-ts': 'npx ts-node-script bbox/migrations/2020-07-16.ts',
  //   // This executes first.
  //   '2020-07-15-js': 'node bbox/migrations/2020-07-15.js',
  // }
}
